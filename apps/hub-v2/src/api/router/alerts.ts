/**
 * Alerts Router
 * Alert configuration and history queries
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { alertConfigs } from '../../db';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const alertsRouter = createTRPCRouter({
  /**
   * Acknowledge an alert
   */
  acknowledge: publicProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.daemon.acknowledgeAlert(input.alertId);
      return { success: true };
    }),
  /**
   * Create a new alert configuration
   */
  create: publicProcedure
    .input(
      z.object({
        alertType: z.enum(['threshold', 'range', 'rate_of_change']),
        enabled: z.boolean().optional(),
        entityId: z.string(),
        field: z.string(),
        homeId: z.string(),
        name: z.string(),
        // Optional threshold config
        rangeMax: z.number().optional(),
        rangeMin: z.number().optional(),
        // Optional rate of change config
        rateThreshold: z.number().optional(),
        rateWindow: z.number().optional(),
        severity: z.enum(['info', 'warning', 'critical']),
        showInGraph: z.boolean().optional(),
        // Optional threshold config
        thresholdOperator: z.enum(['gt', 'lt', 'gte', 'lte']).optional(),
        thresholdValue: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const alertService = ctx.daemon.getAlertService();
      if (!alertService) {
        throw new Error('Alert service not available');
      }

      const result = await alertService.createAlertConfig({
        alertType: input.alertType,
        enabled: input.enabled ?? true,
        entityId: input.entityId,
        field: input.field,
        homeId: input.homeId,
        name: input.name,
        rangeMax: input.rangeMax ?? null,
        rangeMin: input.rangeMin ?? null,
        rateThreshold: input.rateThreshold ?? null,
        rateWindow: input.rateWindow ?? null,
        severity: input.severity,
        showInGraph: input.showInGraph ?? true,
        thresholdOperator: input.thresholdOperator ?? null,
        thresholdValue: input.thresholdValue ?? null,
      });

      return result;
    }),

  /**
   * Delete an alert configuration
   */
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const alertService = ctx.daemon.getAlertService();
      if (!alertService) {
        throw new Error('Alert service not available');
      }

      await alertService.deleteAlertConfig(input.id);

      return { success: true };
    }),

  /**
   * Get a single alert configuration
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = ctx.daemon.getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const config = await db.query.alertConfigs.findFirst({
        where: eq(alertConfigs.id, input.id),
      });

      if (!config) {
        throw new Error('Alert configuration not found');
      }

      return config;
    }),

  /**
   * Get active (unresolved) alerts
   */
  getActive: publicProcedure
    .input(
      z.object({
        homeId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const alerts = await ctx.daemon.getActiveAlerts(input.homeId);
      return alerts;
    }),

  /**
   * Get alert history
   */
  getHistory: publicProcedure
    .input(
      z.object({
        entityId: z.string(),
        limit: z.number().optional(),
        unacknowledged: z.boolean().optional(),
        unresolved: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const history = await ctx.daemon.getAlertHistory(input.entityId, {
        limit: input.limit,
        unacknowledged: input.unacknowledged,
        unresolved: input.unresolved,
      });

      return history;
    }),

  /**
   * List alert configurations
   */
  list: publicProcedure
    .input(
      z.object({
        entityId: z.string().optional(),
        field: z.string().optional(),
        homeId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = ctx.daemon.getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const conditions = [];
      if (input.entityId)
        conditions.push(eq(alertConfigs.entityId, input.entityId));
      if (input.field) conditions.push(eq(alertConfigs.field, input.field));
      if (input.homeId) conditions.push(eq(alertConfigs.homeId, input.homeId));

      const configs = await db.query.alertConfigs.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
      });

      return configs;
    }),

  /**
   * Toggle alert enabled state
   */
  toggle: publicProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const alertService = ctx.daemon.getAlertService();
      if (!alertService) {
        throw new Error('Alert service not available');
      }

      await alertService.updateAlertConfig(input.id, {
        enabled: input.enabled,
      });

      return { success: true };
    }),

  /**
   * Update an alert configuration
   */
  update: publicProcedure
    .input(
      z.object({
        alertType: z.enum(['threshold', 'range', 'rate_of_change']).optional(),
        enabled: z.boolean().optional(),
        field: z.string().optional(),
        id: z.string(),
        name: z.string().optional(),
        rangeMax: z.number().optional().nullable(),
        rangeMin: z.number().optional().nullable(),
        rateThreshold: z.number().optional().nullable(),
        rateWindow: z.number().optional().nullable(),
        severity: z.enum(['info', 'warning', 'critical']).optional(),
        showInGraph: z.boolean().optional(),
        thresholdOperator: z
          .enum(['gt', 'lt', 'gte', 'lte'])
          .optional()
          .nullable(),
        thresholdValue: z.number().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const alertService = ctx.daemon.getAlertService();
      if (!alertService) {
        throw new Error('Alert service not available');
      }

      const { id, ...updates } = input;

      await alertService.updateAlertConfig(id, updates);

      return { success: true };
    }),
});

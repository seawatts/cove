/**
 * Telemetry Router
 * Entity telemetry queries
 */

import type { TimeRange } from '@cove/db/graph-queries';
import { telemetry, telemetryConfig } from '@cove/db/hub';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createHubRouter, publicProcedure } from '../trpc';

// Zod schema for TimeRange (matches the TypeScript type)
const timeRangeSchema = z.enum(['1h', '24h', '7d', '30d', '90d']);

export const telemetryRouter = createHubRouter({
  /**
   * Get entity telemetry data
   */
  get: publicProcedure
    .input(
      z.object({
        entityId: z.string(),
        field: z.string().optional(),
        limit: z.number().optional(),
        since: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { entityId, field, since, limit } = input;

      const telemetryData = await ctx.daemon.getEntityTelemetry(entityId, {
        field,
        limit,
        since,
      });

      return telemetryData;
    }),

  /**
   * Get aggregated entity telemetry data for charts/graphs
   * Aggregates telemetry by time buckets (mean, min, max)
   * Supports either preset timeRange or custom start/end timestamps for zoom
   */
  getAggregated: publicProcedure
    .input(
      z.object({
        endTime: z.number().optional(), // Unix timestamp in ms
        entityId: z.string(),
        field: z.string().optional(),
        // Custom time range for zoom - overrides timeRange if provided
        startTime: z.number().optional(), // Unix timestamp in ms
        timeRange: timeRangeSchema.optional().default('24h'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { entityId, field, timeRange, startTime, endTime } = input;

      // Use custom time range if both start and end are provided
      const options =
        startTime && endTime
          ? {
              endTime: new Date(endTime),
              field,
              startTime: new Date(startTime),
            }
          : {
              field,
              timeRange: timeRange as TimeRange,
            };

      const aggregated = await ctx.daemon.getEntityTelemetryAggregated(
        entityId,
        options,
      );

      return aggregated;
    }),

  /**
   * Get telemetry configuration (history thresholds) for an entity
   */
  getConfig: publicProcedure
    .input(
      z.object({
        entityId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { entityId } = input;

      const db = ctx.daemon.getDb();

      if (!db) {
        throw new Error('Database not available');
      }

      // Get telemetry config for this entity
      const configs = await db
        .select()
        .from(telemetryConfig)
        .where(eq(telemetryConfig.entityId, entityId));

      return configs;
    }),

  /**
   * Get distinct telemetry fields for an entity
   */
  getFields: publicProcedure
    .input(
      z.object({
        entityId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { entityId } = input;

      const db = ctx.daemon.getDb();

      if (!db) {
        throw new Error('Database not available');
      }

      // Get distinct fields for this entity from telemetry table
      const result = await db
        .selectDistinct({ field: telemetry.field })
        .from(telemetry)
        .where(eq(telemetry.entityId, entityId));

      return result.map((r: { field: string }) => r.field);
    }),
});

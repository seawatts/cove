/**
 * Cloud Telemetry Router
 * Query mirrored telemetry data from cloud Postgres database
 * Mirrors hub API structure for seamless fallback
 *
 * Note: Cloud only stores recent telemetry (e.g., last 7 days) for charts
 * Hub retains full telemetry history
 */

import { entities, entityStateHistories, hubs } from '@cove/db/schema';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const cloudTelemetryRouter = createTRPCRouter({
  /**
   * Get entity telemetry data
   * Mirrors hub API: hubApi.telemetry.get
   * Limited to recent data stored in cloud
   */
  get: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        field: z.string().optional(),
        limit: z.number().optional(),
        since: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { entityId, since, limit = 100 } = input;

      // Verify entity access
      const entity = await ctx.db.query.entities.findFirst({
        where: eq(entities.id, entityId),
      });

      if (!entity) {
        throw new Error('Entity not found');
      }

      // Verify user has access to this hub
      if (entity.hubId) {
        const hub = await ctx.db.query.hubs.findFirst({
          where: eq(hubs.id, entity.hubId),
        });

        if (hub && hub.ownerId !== ctx.auth.userId) {
          throw new Error('Unauthorized');
        }
      }

      // Build where conditions
      const conditions = [eq(entityStateHistories.entityId, entityId)];
      if (since) {
        conditions.push(gte(entityStateHistories.ts, since));
      }

      // Get telemetry from entityStateHistories
      const telemetryData = await ctx.db
        .select()
        .from(entityStateHistories)
        .where(and(...conditions))
        .orderBy(desc(entityStateHistories.ts))
        .limit(limit);

      return telemetryData;
    }),

  /**
   * Get aggregated telemetry for charts
   * Mirrors hub API: hubApi.telemetry.getAggregated
   * Limited to recent data stored in cloud
   */
  getAggregated: protectedProcedure
    .input(
      z.object({
        endTime: z.date().optional(),
        entityId: z.string(),
        startTime: z.date().optional(),
        timeRange: z.enum(['1h', '24h', '7d', '30d', '90d']).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { entityId, timeRange = '24h', startTime, endTime } = input;

      // Verify entity access
      const entity = await ctx.db.query.entities.findFirst({
        where: eq(entities.id, entityId),
      });

      if (!entity) {
        throw new Error('Entity not found');
      }

      // Verify user has access to this hub
      if (entity.hubId) {
        const hub = await ctx.db.query.hubs.findFirst({
          where: eq(hubs.id, entity.hubId),
        });

        if (hub && hub.ownerId !== ctx.auth.userId) {
          throw new Error('Unauthorized');
        }
      }

      // Calculate time range
      const end = endTime || new Date();
      let start: Date;

      if (startTime) {
        start = startTime;
      } else {
        // Calculate based on timeRange
        const now = new Date();
        switch (timeRange) {
          case '1h':
            start = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case '24h':
            start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        }
      }

      // Get telemetry data
      const conditions = [
        eq(entityStateHistories.entityId, entityId),
        gte(entityStateHistories.ts, start),
        lte(entityStateHistories.ts, end),
      ];

      const telemetryData = await ctx.db
        .select()
        .from(entityStateHistories)
        .where(and(...conditions))
        .orderBy(entityStateHistories.ts);

      // Simple aggregation - return raw data points
      // The hub does more sophisticated aggregation with time buckets
      // For cloud mirror, we just return the available data
      return telemetryData.map((row) => ({
        mean: row.state,
        timestamp: row.ts.getTime(),
      }));
    }),
});

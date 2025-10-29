/**
 * Telemetry Router
 * Entity telemetry queries
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const telemetryRouter = createTRPCRouter({
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

      const telemetry = await ctx.daemon.getEntityTelemetry(entityId, {
        field,
        limit,
        since,
      });

      return telemetry;
    }),

  /**
   * Get aggregated entity telemetry data for charts/graphs
   * Aggregates telemetry by time buckets (mean, min, max)
   */
  getAggregated: publicProcedure
    .input(
      z.object({
        entityId: z.string(),
        field: z.string().optional(),
        timeRange: z
          .enum(['1h', '24h', '7d', '30d', '90d'])
          .optional()
          .default('24h'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { entityId, field, timeRange } = input;

      const aggregated = await ctx.daemon.getEntityTelemetryAggregated(
        entityId,
        {
          field,
          timeRange,
        },
      );

      return aggregated;
    }),
});

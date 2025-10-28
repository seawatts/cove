/**
 * Graph Router
 * Wraps the optimized TimescaleDB graph query functions for tRPC
 */

import {
  getEntityAggregatedData,
  getEntityRawHistory,
  getHomeAggregatedData,
  getMultiEntityAggregatedData,
  getRoomAggregatedData,
  type TimeBucket,
  type TimeRange,
} from '@cove/db/graph-queries';
import type { EntityKind } from '@cove/types';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const graphRouter = createTRPCRouter({
  /**
   * Get aggregated sensor data for a single entity using TimescaleDB continuous aggregates
   * This is the most efficient way to query time-series data for charts
   */
  getEntityAggregatedData: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        timeBucket: z
          .enum(['1min', '5min', '10min', '30min', '1hour', '1day'])
          .optional(),
        timeRange: z
          .enum(['1h', '24h', '7d', '30d', '90d'])
          .optional()
          .default('24h'),
      }),
    )
    .query(async ({ input }) => {
      const { entityId, timeRange, timeBucket } = input;
      return getEntityAggregatedData(
        entityId,
        timeRange as TimeRange,
        timeBucket as TimeBucket,
      );
    }),

  /**
   * Get raw state history for a single entity (fallback when continuous aggregates aren't available)
   */
  getEntityRawHistory: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        limit: z.number().min(1).max(1000).optional().default(1000),
        timeRange: z
          .enum(['1h', '24h', '7d', '30d', '90d'])
          .optional()
          .default('24h'),
      }),
    )
    .query(async ({ input }) => {
      const { entityId, timeRange, limit } = input;
      return getEntityRawHistory(entityId, timeRange as TimeRange, limit);
    }),

  /**
   * Get aggregated sensor data for all entities of a specific kind in a home
   */
  getHomeAggregatedData: protectedProcedure
    .input(
      z.object({
        entityKind: z.string(),
        homeId: z.string(),
        timeBucket: z
          .enum(['1min', '5min', '10min', '30min', '1hour', '1day'])
          .optional(),
        timeRange: z
          .enum(['1h', '24h', '7d', '30d', '90d'])
          .optional()
          .default('24h'),
      }),
    )
    .query(async ({ input }) => {
      const { homeId, entityKind, timeRange, timeBucket } = input;
      return getHomeAggregatedData(
        homeId,
        entityKind as EntityKind,
        timeRange as TimeRange,
        timeBucket as TimeBucket,
      );
    }),

  /**
   * Get aggregated data for multiple entities for comparison charts
   */
  getMultiEntityAggregatedData: protectedProcedure
    .input(
      z.object({
        entityIds: z.array(z.string()),
        timeBucket: z
          .enum(['1min', '5min', '10min', '30min', '1hour', '1day'])
          .optional(),
        timeRange: z
          .enum(['1h', '24h', '7d', '30d', '90d'])
          .optional()
          .default('24h'),
      }),
    )
    .query(async ({ input }) => {
      const { entityIds, timeRange } = input;
      return getMultiEntityAggregatedData(entityIds, timeRange as TimeRange);
    }),

  /**
   * Get aggregated sensor data for all entities in a room
   */
  getRoomAggregatedData: protectedProcedure
    .input(
      z.object({
        entityKind: z.string(),
        roomId: z.string(),
        timeBucket: z
          .enum(['1min', '5min', '10min', '30min', '1hour', '1day'])
          .optional(),
        timeRange: z
          .enum(['1h', '24h', '7d', '30d', '90d'])
          .optional()
          .default('24h'),
      }),
    )
    .query(async ({ input }) => {
      const { roomId, entityKind, timeRange, timeBucket } = input;
      return getRoomAggregatedData(
        roomId,
        entityKind as EntityKind,
        timeRange as TimeRange,
        timeBucket as TimeBucket,
      );
    }),
});

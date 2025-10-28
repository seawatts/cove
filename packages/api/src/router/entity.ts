/**
 * Entity Router
 * Handles entities-related API endpoints for Home Assistant-inspired architecture
 */

import {
  devices,
  entities,
  entityStateHistories,
  entityStates,
  rooms,
} from '@cove/db/schema';
import type { EntityKind } from '@cove/types';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '../env.server';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const entitiesRouter = createTRPCRouter({
  /**
   * Get entities with current state
   */
  get: protectedProcedure
    .input(z.object({ entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { entityId } = input;

      const result = await ctx.db
        .select({
          capabilities: entities.capabilities,
          currentState: {
            attrs: entityStates.attrs,
            state: entityStates.state,
            updatedAt: entityStates.updatedAt,
          },
          deviceClass: entities.deviceClass,
          deviceId: entities.deviceId,
          devices: {
            deviceId: devices.id,
            manufacturer: devices.manufacturer,
            model: devices.model,
            name: devices.name,
          },
          entityId: entities.id,
          key: entities.key,
          kind: entities.kind,
          name: entities.name,
          rooms: {
            name: rooms.name,
            roomId: rooms.id,
          },
        })
        .from(entities)
        .leftJoin(entityStates, eq(entityStates.entityId, entities.id))
        .leftJoin(devices, eq(devices.id, entities.deviceId))
        .leftJoin(rooms, eq(rooms.id, devices.roomId))
        .where(eq(entities.id, entityId))
        .limit(1);

      if (result.length === 0) {
        throw new Error('Entity not found');
      }

      return result[0];
    }),

  /**
   * Get entities for a devices
   */
  getByDevice: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { deviceId } = input;

      const result = await ctx.db
        .select({
          capabilities: entities.capabilities,
          currentState: {
            attrs: entityStates.attrs,
            state: entityStates.state,
            updatedAt: entityStates.updatedAt,
          },
          deviceClass: entities.deviceClass,
          deviceId: entities.deviceId,
          entityId: entities.id,
          key: entities.key,
          kind: entities.kind,
          name: entities.name,
        })
        .from(entities)
        .leftJoin(entityStates, eq(entityStates.entityId, entities.id))
        .where(eq(entities.deviceId, deviceId))
        .orderBy(entities.key);

      return result;
    }),

  /**
   * Get entities by kind (e.g., all lights, all sensors)
   */
  getByKind: protectedProcedure
    .input(
      z.object({
        homeId: z.string().optional(),
        kind: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { kind, homeId } = input;

      const whereCondition = homeId
        ? and(eq(entities.kind, kind as EntityKind), eq(devices.homeId, homeId))
        : eq(entities.kind, kind as EntityKind);

      const result = await ctx.db
        .select({
          capabilities: entities.capabilities,
          currentState: {
            attrs: entityStates.attrs,
            state: entityStates.state,
            updatedAt: entityStates.updatedAt,
          },
          deviceClass: entities.deviceClass,
          deviceId: entities.deviceId,
          devices: {
            deviceId: devices.id,
            manufacturer: devices.manufacturer,
            model: devices.model,
            name: devices.name,
          },
          entityId: entities.id,
          key: entities.key,
          kind: entities.kind,
          name: entities.name,
          rooms: {
            name: rooms.name,
            roomId: rooms.id,
          },
        })
        .from(entities)
        .leftJoin(entityStates, eq(entityStates.entityId, entities.id))
        .leftJoin(devices, eq(devices.id, entities.deviceId))
        .leftJoin(rooms, eq(rooms.id, devices.roomId))
        .where(whereCondition)
        .orderBy(entities.key);

      return result;
    }),

  /**
   * Get hourly aggregated data from TimescaleDB continuous aggregate
   */
  getHourlySeries: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { entityId, from, to } = input;

      // Query the continuous aggregate materialized view
      const result = await ctx.db.execute(sql`
        SELECT
          "entityId",
          hour_start,
          mean,
          min,
          max,
          last_state
        FROM entity_state_hourly
        WHERE "entityId" = ${entityId}
          AND hour_start >= ${from}
          AND hour_start < ${to}
        ORDER BY hour_start ASC
      `);

      // Handle the result properly - db.execute returns different types
      const rows = Array.isArray(result) ? result : result.rows || [];
      return rows.map((row: Record<string, unknown>) => ({
        entityId: row.entityId,
        hourStart: row.hour_start,
        lastState: row.last_state,
        max: row.max,
        mean: row.mean,
        min: row.min,
      }));
    }),

  /**
   * Get entities state history
   */
  getStateHistory: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        limit: z.number().min(1).max(1000).optional().default(100),
        timeRange: z
          .enum(['1h', '24h', '7d', '30d', '90d'])
          .optional()
          .default('24h'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { entityId, timeRange, limit } = input;

      // Calculate time range
      const now = new Date();
      let startTime: Date;

      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const result = await ctx.db
        .select({
          attrs: entityStateHistories.attrs,
          entityId: entityStateHistories.entityId,
          id: entityStateHistories.id,
          state: entityStateHistories.state,
          ts: entityStateHistories.ts,
        })
        .from(entityStateHistories)
        .where(
          and(
            eq(entityStateHistories.entityId, entityId),
            gte(entityStateHistories.ts, startTime),
            lte(entityStateHistories.ts, now),
          ),
        )
        .orderBy(desc(entityStateHistories.ts))
        .limit(limit);

      return result;
    }),

  /**
   * Get entities statistics
   */
  getStats: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        timeRange: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { entityId, timeRange } = input;

      // Calculate time range
      const now = new Date();
      let startTime: Date;

      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      // Get statistics from history
      const stats = await ctx.db.execute(sql`
        SELECT
          COUNT(*) as total_records,
          MIN(ts) as first_record,
          MAX(ts) as last_record,
          AVG(CASE WHEN state ~ '^[0-9]+\.?[0-9]*$' THEN state::numeric ELSE NULL END) as avg_value,
          MIN(CASE WHEN state ~ '^[0-9]+\.?[0-9]*$' THEN state::numeric ELSE NULL END) as min_value,
          MAX(CASE WHEN state ~ '^[0-9]+\.?[0-9]*$' THEN state::numeric ELSE NULL END) as max_value
        FROM entity_state_histories
        WHERE "entityId" = ${entityId}
          AND ts >= ${startTime}
          AND ts <= ${now}
      `);

      // Handle the result properly - db.execute returns different types
      const rows = Array.isArray(stats) ? stats : stats.rows || [];
      const row = rows[0] as Record<string, unknown>;

      return {
        avgValue: row.avg_value
          ? Number.parseFloat(String(row.avg_value))
          : null,
        firstRecord: row.first_record as string | null,
        lastRecord: row.last_record as string | null,
        maxValue: row.max_value
          ? Number.parseFloat(String(row.max_value))
          : null,
        minValue: row.min_value
          ? Number.parseFloat(String(row.min_value))
          : null,
        timeRange,
        totalRecords: Number.parseInt(String(row.total_records), 10) || 0,
      };
    }),

  /**
   * Send command to entity via hub
   */
  sendCommand: protectedProcedure
    .input(
      z.object({
        capability: z.string(), // 'on_off', 'brightness', etc.
        entityId: z.string(),
        value: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { entityId, capability, value } = input;
      const userId = ctx.auth?.userId;

      try {
        // Send command to hub
        const hubUrl = env.HUB_URL;
        const response = await fetch(`${hubUrl}/api/command`, {
          body: JSON.stringify({
            capability,
            entityId,
            userId,
            value,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Hub command failed with status ${response.status}`,
          );
        }

        const result = await response.json();
        return {
          latency: result.latency,
          success: result.success,
        };
      } catch (error) {
        throw new Error(
          `Failed to send command to entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }),

  /**
   * Update entities state (for testing/manual control)
   */
  setState: protectedProcedure
    .input(
      z.object({
        attrs: z.record(z.string(), z.unknown()).optional(),
        entityId: z.string(),
        state: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { entityId, state, attrs } = input;

      // Update entities_state table
      await ctx.db
        .insert(entityStates)
        .values({
          attrs,
          entityId,
          state,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            attrs,
            state,
            updatedAt: new Date(),
          },
          target: entityStates.entityId,
        });

      // Get devices homeId for history record
      const devicesInfo = await ctx.db
        .select({ homeId: devices.homeId })
        .from(entities)
        .leftJoin(devices, eq(devices.id, entities.deviceId))
        .where(eq(entities.id, entityId))
        .limit(1);

      // Insert into history
      await ctx.db.insert(entityStateHistories).values({
        attrs,
        entityId,
        homeId: devicesInfo[0]?.homeId || '',
        state,
        ts: new Date(),
      });

      return { success: true };
    }),
});

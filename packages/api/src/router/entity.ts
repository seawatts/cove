/**
 * Entity Router
 * Handles entity-related API endpoints for Home Assistant-inspired architecture
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@cove/db/client';
import { 
  entity, 
  entityState, 
  entityStateHistory, 
  device,
  room,
} from '@cove/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export const entityRouter = createTRPCRouter({
  /**
   * Get entity with current state
   */
  get: protectedProcedure
    .input(z.object({ entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { entityId } = input;

      const result = await db
        .select({
          entityId: entity.id,
          deviceId: entity.deviceId,
          kind: entity.kind,
          key: entity.key,
          traits: entity.traits,
          currentState: {
            state: entityState.state,
            attrs: entityState.attrs,
            updatedAt: entityState.updatedAt,
          },
          device: {
            deviceId: device.id,
            name: device.name,
            manufacturer: device.manufacturer,
            model: device.model,
          },
          room: {
            roomId: room.id,
            name: room.name,
          },
        })
        .from(entity)
        .leftJoin(entityState, eq(entityState.entityId, entity.id))
        .leftJoin(device, eq(device.id, entity.deviceId))
        .leftJoin(room, eq(room.id, device.roomId))
        .where(eq(entity.id, entityId))
        .limit(1);

      if (result.length === 0) {
        throw new Error('Entity not found');
      }

      return result[0];
    }),

  /**
   * Get entity state history
   */
  getStateHistory: protectedProcedure
    .input(z.object({ 
      entityId: z.string(),
      timeRange: z.enum(['1h', '24h', '7d', '30d', '90d']).optional().default('24h'),
      limit: z.number().min(1).max(1000).optional().default(100),
    }))
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

      const result = await db
        .select({
          id: entityStateHistory.id,
          entityId: entityStateHistory.entityId,
          ts: entityStateHistory.ts,
          state: entityStateHistory.state,
          attrs: entityStateHistory.attrs,
        })
        .from(entityStateHistory)
        .where(
          and(
            eq(entityStateHistory.entityId, entityId),
            gte(entityStateHistory.ts, startTime),
            lte(entityStateHistory.ts, now),
          ),
        )
        .orderBy(desc(entityStateHistory.ts))
        .limit(limit);

      return result;
    }),

  /**
   * Get hourly aggregated data from TimescaleDB continuous aggregate
   */
  getHourlySeries: protectedProcedure
    .input(z.object({ 
      entityId: z.string(),
      from: z.date(),
      to: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const { entityId, from, to } = input;

      // Query the continuous aggregate materialized view
      const result = await db.execute(sql`
        SELECT 
          entity_id,
          hour_start,
          mean,
          min,
          max,
          last_state
        FROM entity_state_hourly
        WHERE entity_id = ${entityId}
          AND hour_start >= ${from}
          AND hour_start < ${to}
        ORDER BY hour_start ASC
      `);

      return result.rows.map((row: any) => ({
        entityId: row.entity_id,
        hourStart: row.hour_start,
        mean: row.mean,
        min: row.min,
        max: row.max,
        lastState: row.last_state,
      }));
    }),

  /**
   * Get entities for a device
   */
  getByDevice: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { deviceId } = input;

      const result = await db
        .select({
          entityId: entity.id,
          deviceId: entity.deviceId,
          kind: entity.kind,
          key: entity.key,
          traits: entity.traits,
          currentState: {
            state: entityState.state,
            attrs: entityState.attrs,
            updatedAt: entityState.updatedAt,
          },
        })
        .from(entity)
        .leftJoin(entityState, eq(entityState.entityId, entity.id))
        .where(eq(entity.deviceId, deviceId))
        .orderBy(entity.key);

      return result;
    }),

  /**
   * Get entities by kind (e.g., all lights, all sensors)
   */
  getByKind: protectedProcedure
    .input(z.object({ 
      kind: z.string(),
      homeId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { kind, homeId } = input;

      let query = db
        .select({
          entityId: entity.id,
          deviceId: entity.deviceId,
          kind: entity.kind,
          key: entity.key,
          traits: entity.traits,
          currentState: {
            state: entityState.state,
            attrs: entityState.attrs,
            updatedAt: entityState.updatedAt,
          },
          device: {
            deviceId: device.id,
            name: device.name,
            manufacturer: device.manufacturer,
            model: device.model,
          },
          room: {
            roomId: room.id,
            name: room.name,
          },
        })
        .from(entity)
        .leftJoin(entityState, eq(entityState.entityId, entity.id))
        .leftJoin(device, eq(device.id, entity.deviceId))
        .leftJoin(room, eq(room.id, device.roomId))
        .where(eq(entity.kind, kind));

      if (homeId) {
        query = query.where(eq(device.homeId, homeId));
      }

      const result = await query.orderBy(entity.key);

      return result;
    }),

  /**
   * Update entity state (for testing/manual control)
   */
  setState: protectedProcedure
    .input(z.object({
      entityId: z.string(),
      state: z.string(),
      attrs: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { entityId, state, attrs } = input;

      // Update entity_state table
      await db
        .insert(entityState)
        .values({
          entityId,
          state,
          attrs,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: entityState.entityId,
          set: {
            state,
            attrs,
            updatedAt: new Date(),
          },
        });

      // Insert into history
      await db
        .insert(entityStateHistory)
        .values({
          entityId,
          ts: new Date(),
          state,
          attrs,
        });

      return { success: true };
    }),

  /**
   * Get entity statistics
   */
  getStats: protectedProcedure
    .input(z.object({ 
      entityId: z.string(),
      timeRange: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
    }))
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
      const stats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_records,
          MIN(ts) as first_record,
          MAX(ts) as last_record,
          AVG(CASE WHEN state ~ '^[0-9]+\.?[0-9]*$' THEN state::numeric ELSE NULL END) as avg_value,
          MIN(CASE WHEN state ~ '^[0-9]+\.?[0-9]*$' THEN state::numeric ELSE NULL END) as min_value,
          MAX(CASE WHEN state ~ '^[0-9]+\.?[0-9]*$' THEN state::numeric ELSE NULL END) as max_value
        FROM entity_state_history
        WHERE entity_id = ${entityId}
          AND ts >= ${startTime}
          AND ts <= ${now}
      `);

      const row = stats.rows[0] as any;
      
      return {
        totalRecords: parseInt(row.total_records) || 0,
        firstRecord: row.first_record,
        lastRecord: row.last_record,
        avgValue: row.avg_value ? parseFloat(row.avg_value) : null,
        minValue: row.min_value ? parseFloat(row.min_value) : null,
        maxValue: row.max_value ? parseFloat(row.max_value) : null,
        timeRange,
      };
    }),
});


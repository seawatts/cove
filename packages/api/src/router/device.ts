/**
 * Device Router
 * Updated for Home Assistant-inspired entity-first architecture
 */

import { and, asc, desc, eq, gte, sql } from '@cove/db';
import { 
  device, 
  entity, 
  entityState, 
  room,
  home,
} from '@cove/db/schema';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const deviceRouter = createTRPCRouter({
  /**
   * Get a specific device with its entities
   */
  get: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const deviceResult = await ctx.db
        .select({
          deviceId: device.id,
          homeId: device.homeId,
          roomId: device.roomId,
          name: device.name,
          manufacturer: device.manufacturer,
          model: device.model,
          swVersion: device.swVersion,
          ipAddr: device.ipAddress,
          metadata: device.metadata,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt,
          room: {
            roomId: room.id,
            name: room.name,
          },
        })
        .from(device)
        .leftJoin(room, eq(room.id, device.roomId))
        .where(eq(device.id, input.id))
        .limit(1);

      if (deviceResult.length === 0) {
        throw new Error('Device not found');
      }

      const deviceInfo = deviceResult[0];

      // Get entities for this device
      const entities = await ctx.db
        .select({
          entityId: entity.id,
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
        .where(eq(entity.id, input.id))
        .orderBy(entity.key);

      return {
        ...deviceInfo,
        entities,
      };
    }),

  /**
   * Get entities for a device
   */
  getEntities: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({
          entityId: entity.id,
          deviceId: entity.id,
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
        .where(eq(entity.id, input.id))
        .orderBy(entity.key);

      return result;
    }),

  /**
   * List all devices in a home
   */
  list: protectedProcedure
    .input(z.object({ 
      homeId: z.string(),
      roomId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { homeId, roomId } = input;

      let query = ctx.db
        .select({
          deviceId: device.id,
          homeId: device.homeId,
          roomId: device.roomId,
          name: device.name,
          manufacturer: device.manufacturer,
          model: device.model,
          swVersion: device.swVersion,
          ipAddr: device.ipAddress,
          metadata: device.metadata,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt,
          room: {
            roomId: room.id,
            name: room.name,
          },
          entityCount: sql<number>`COUNT(${entity.id})`,
        })
        .from(device)
        .leftJoin(room, eq(room.id, device.roomId))
        .leftJoin(entity, eq(entity.id, device.id))
        .where(eq(device.homeId, homeId))
        .groupBy(
          device.id,
          device.homeId,
          device.roomId,
          device.name,
          device.manufacturer,
          device.model,
          device.swVersion,
          device.ipAddress,
          device.metadata,
          device.createdAt,
          device.updatedAt,
          room.id,
          room.name,
        )
        .orderBy(device.name);

      if (roomId) {
        query = query.where(eq(device.roomId, roomId));
      }

      const result = await query;

      return result;
    }),

  /**
   * Create a new device
   */
  create: protectedProcedure
    .input(z.object({
      homeId: z.string(),
      name: z.string().min(1),
      manufacturer: z.string().optional(),
      model: z.string().optional(),
      swVersion: z.string().optional(),
      ipAddr: z.string().optional(),
      roomId: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(device)
        .values({
          homeId: input.homeId,
          name: input.name,
          manufacturer: input.manufacturer,
          model: input.model,
          swVersion: input.swVersion,
          ipAddr: input.ipAddress,
          roomId: input.roomId,
          metadata: input.metadata || {},
        })
        .returning();

      return result[0];
    }),

  /**
   * Update a device
   */
  update: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      name: z.string().min(1).optional(),
      manufacturer: z.string().optional(),
      model: z.string().optional(),
      swVersion: z.string().optional(),
      ipAddr: z.string().optional(),
      roomId: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { deviceId, ...updates } = input;

      const result = await ctx.db
        .update(device)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(device.id, deviceId))
        .returning();

      if (result.length === 0) {
        throw new Error('Device not found');
      }

      return result[0];
    }),

  /**
   * Delete a device
   */
  delete: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(device).where(eq(device.id, input.id));
      return { success: true };
    }),

  /**
   * Get device statistics
   */
  getStats: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { homeId } = input;

      // Get device count by room
      const roomStats = await ctx.db
        .select({
          roomId: room.id,
          roomName: room.name,
          deviceCount: sql<number>`COUNT(${device.id})`,
        })
        .from(room)
        .leftJoin(device, eq(device.roomId, room.id))
        .where(eq(room.homeId, homeId))
        .groupBy(room.id, room.name);

      // Get total device count
      const totalDevices = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(device)
        .where(eq(device.homeId, homeId));

      // Get device count by manufacturer
      const manufacturerStats = await ctx.db
        .select({
          manufacturer: device.manufacturer,
          count: sql<number>`COUNT(*)`,
        })
        .from(device)
        .where(eq(device.homeId, homeId))
        .groupBy(device.manufacturer);

      return {
        totalDevices: totalDevices[0]?.count || 0,
        roomStats,
        manufacturerStats,
      };
    }),

  /**
   * Clean up duplicate devices (keeps the most recent one per IP+protocol combination)
   */
  cleanupDuplicates: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { homeId } = input;

      // Get all devices for the home
      const allDevices = await ctx.db
        .select()
        .from(device)
        .where(eq(device.homeId, homeId))
        .orderBy(desc(device.createdAt));

    // Group devices by IP + protocol
    const deviceGroups = new Map<string, typeof allDevices>();
      for (const deviceItem of allDevices) {
        if (deviceItem.ipAddress) {
          const key = `${deviceItem.ipAddress}`;
        const group = deviceGroups.get(key) || [];
          group.push(deviceItem);
        deviceGroups.set(key, group);
      }
    }

    // Find duplicates (groups with more than one device)
    let deletedCount = 0;
    for (const [, group] of deviceGroups) {
      if (group.length > 1) {
        // Keep the first one (most recent), delete the rest
        const [_keep, ...toDelete] = group;
          for (const deviceItem of toDelete) {
            await ctx.db.delete(device).where(eq(device.id, deviceItem.id));
          deletedCount++;
        }
      }
    }

    return {
      deletedCount,
      message: `Removed ${deletedCount} duplicate device(s)`,
    };
    }),
});
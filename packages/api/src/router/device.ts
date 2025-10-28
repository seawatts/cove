/**
 * Device Router
 * Updated for Home Assistant-inspired entity-first architecture
 */

import { and, desc, eq, sql } from '@cove/db';
import { devices, entities, entityStates, rooms } from '@cove/db/schema';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const deviceRouter = createTRPCRouter({
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
        .from(devices)
        .where(eq(devices.homeId, homeId))
        .orderBy(desc(devices.createdAt));

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
            await ctx.db.delete(devices).where(eq(devices.id, deviceItem.id));
            deletedCount++;
          }
        }
      }

      return {
        deletedCount,
        message: `Removed ${deletedCount} duplicate device(s)`,
      };
    }),

  /**
   * Create a new device
   */
  create: protectedProcedure
    .input(
      z.object({
        categories: z.array(z.string()).optional(),
        configUrl: z.string().optional(),
        externalId: z.string().optional(),
        homeId: z.string(),
        hostname: z.string().optional(),
        hwVersion: z.string().optional(),
        ipAddr: z.string().optional(),
        macAddress: z.string().optional(),
        manufacturer: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        model: z.string().optional(),
        name: z.string().min(1),
        port: z.number().optional(),
        protocol: z.string(),
        roomId: z.string().optional(),
        swVersion: z.string().optional(),
        type: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(devices)
        .values({
          available: true,
          categories: input.categories || [],
          configUrl: input.configUrl,
          entryType: 'device',
          externalId: input.externalId,
          homeId: input.homeId,
          hostname: input.hostname,
          hwVersion: input.hwVersion,
          ipAddress: input.ipAddr,
          macAddress: input.macAddress,
          manufacturer: input.manufacturer,
          metadata: input.metadata || {},
          model: input.model,
          name: input.name,
          port: input.port,
          protocol: input.protocol,
          roomId: input.roomId,
          swVersion: input.swVersion,
          type: input.type,
        })
        .returning();

      return result[0];
    }),

  /**
   * Delete a device
   */
  delete: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(devices).where(eq(devices.id, input.deviceId));
      return { success: true };
    }),
  /**
   * Get a specific device with its entities
   */
  get: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const deviceResult = await ctx.db
        .select({
          available: devices.available,
          categories: devices.categories,
          configUrl: devices.configUrl,
          createdAt: devices.createdAt,
          deviceId: devices.id,
          homeId: devices.homeId,
          hostname: devices.hostname,
          hwVersion: devices.hwVersion,
          ipAddr: devices.ipAddress,
          lastSeen: devices.lastSeen,
          macAddress: devices.macAddress,
          manufacturer: devices.manufacturer,
          matterNodeId: devices.matterNodeId,
          metadata: devices.metadata,
          model: devices.model,
          name: devices.name,
          online: devices.online,
          port: devices.port,
          protocol: devices.protocol,
          room: {
            name: rooms.name,
            roomId: rooms.id,
          },
          roomId: devices.roomId,
          swVersion: devices.swVersion,
          type: devices.type,
          updatedAt: devices.updatedAt,
        })
        .from(devices)
        .leftJoin(rooms, eq(rooms.id, devices.roomId))
        .where(eq(devices.id, input.deviceId))
        .limit(1);

      if (deviceResult.length === 0) {
        throw new Error('Device not found');
      }

      const deviceInfo = deviceResult[0];

      // Get entities for this device
      const entityList = await ctx.db
        .select({
          capabilities: entities.capabilities,
          currentState: {
            attrs: entityStates.attrs,
            state: entityStates.state,
            updatedAt: entityStates.updatedAt,
          },
          deviceClass: entities.deviceClass,
          entityId: entities.id,
          key: entities.key,
          kind: entities.kind,
          name: entities.name,
        })
        .from(entities)
        .leftJoin(entityStates, eq(entityStates.entityId, entities.id))
        .where(eq(entities.deviceId, input.deviceId))
        .orderBy(entities.key);

      return {
        ...deviceInfo,
        entities: entityList,
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
        .where(eq(entities.deviceId, input.deviceId))
        .orderBy(entities.key);

      return result;
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
          deviceCount: sql<number>`COUNT(${devices.id})`,
          roomId: rooms.id,
          roomName: rooms.name,
        })
        .from(rooms)
        .leftJoin(devices, eq(devices.roomId, rooms.id))
        .where(eq(rooms.homeId, homeId))
        .groupBy(rooms.id, rooms.name);

      // Get total device count
      const totalDevices = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(devices)
        .where(eq(devices.homeId, homeId));

      // Get device count by manufacturer
      const manufacturerStats = await ctx.db
        .select({
          count: sql<number>`COUNT(*)`,
          manufacturer: devices.manufacturer,
        })
        .from(devices)
        .where(eq(devices.homeId, homeId))
        .groupBy(devices.manufacturer);

      return {
        manufacturerStats,
        roomStats,
        totalDevices: totalDevices[0]?.count || 0,
      };
    }),

  /**
   * List all devices in a home
   */
  list: protectedProcedure
    .input(
      z.object({
        homeId: z.string(),
        roomId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { homeId, roomId } = input;

      const whereCondition = roomId
        ? and(eq(devices.homeId, homeId), eq(devices.roomId, roomId))
        : eq(devices.homeId, homeId);

      const result = await ctx.db
        .select({
          createdAt: devices.createdAt,
          deviceId: devices.id,
          entityCount: sql<number>`COUNT(${entities.id})`,
          homeId: devices.homeId,
          ipAddr: devices.ipAddress,
          manufacturer: devices.manufacturer,
          metadata: devices.metadata,
          model: devices.model,
          name: devices.name,
          room: {
            name: rooms.name,
            roomId: rooms.id,
          },
          roomId: devices.roomId,
          swVersion: devices.swVersion,
          updatedAt: devices.updatedAt,
        })
        .from(devices)
        .leftJoin(rooms, eq(rooms.id, devices.roomId))
        .leftJoin(entities, eq(entities.deviceId, devices.id))
        .where(whereCondition)
        .groupBy(
          devices.id,
          devices.homeId,
          devices.roomId,
          devices.name,
          devices.manufacturer,
          devices.model,
          devices.swVersion,
          devices.ipAddress,
          devices.metadata,
          devices.createdAt,
          devices.updatedAt,
          rooms.id,
          rooms.name,
        )
        .orderBy(devices.name);

      return result;
    }),

  /**
   * Update a device
   */
  update: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        ipAddr: z.string().optional(),
        manufacturer: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        model: z.string().optional(),
        name: z.string().min(1).optional(),
        roomId: z.string().optional(),
        swVersion: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { deviceId, ...updates } = input;

      const result = await ctx.db
        .update(devices)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(devices.id, deviceId))
        .returning();

      if (result.length === 0) {
        throw new Error('Device not found');
      }

      return result[0];
    }),
});

/**
 * Home Router
 * Handles home and household management for Home Assistant-inspired architecture
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { db } from '@cove/db/client';
import { 
  home, 
  household, 
  appUser, 
  userMembership,
  device,
  entity,
  room,
  floor,
} from '@cove/db/schema';
import { eq, and, count } from 'drizzle-orm';

export const homeRouter = createTRPCRouter({
  /**
   * Get current user's home
   */
  get: protectedProcedure
    .query(async ({ ctx }) => {
      // For now, we'll get the first home
      // In a real implementation, this would be based on user authentication
      const result = await db
        .select({
          homeId: home.homeId,
          name: home.name,
          timezone: home.timezone,
          address: home.address,
          createdAt: home.createdAt,
          updatedAt: home.updatedAt,
        })
        .from(home)
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0];
    }),

  /**
   * Create a new home
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      timezone: z.string().optional().default('America/Los_Angeles'),
      address: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { name, timezone, address } = input;

      const result = await db
        .insert(home)
        .values({
          name,
          timezone,
          address,
        })
        .returning();

      return result[0];
    }),

  /**
   * Update home
   */
  update: protectedProcedure
    .input(z.object({
      homeId: z.string(),
      name: z.string().min(1).optional(),
      timezone: z.string().optional(),
      address: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { homeId, ...updates } = input;

      const result = await db
        .update(home)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(home.homeId, homeId))
        .returning();

      if (result.length === 0) {
        throw new Error('Home not found');
      }

      return result[0];
    }),

  /**
   * Get home with details (devices, entities, rooms, etc.)
   */
  getDetails: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { homeId } = input;

      // Get home info
      const homeResult = await db
        .select()
        .from(home)
        .where(eq(home.homeId, homeId))
        .limit(1);

      if (homeResult.length === 0) {
        throw new Error('Home not found');
      }

      const homeInfo = homeResult[0];

      // Get device count
      const deviceCountResult = await db
        .select({ count: count() })
        .from(device)
        .where(eq(device.homeId, homeId));

      // Get entity count
      const entityCountResult = await db
        .select({ count: count() })
        .from(entity)
        .innerJoin(device, eq(device.id, entity.deviceId))
        .where(eq(device.homeId, homeId));

      // Get rooms
      const rooms = await db
        .select({
          roomId: room.id,
          name: room.name,
          floorId: room.floorId,
          floor: {
            floorId: floor.id,
            name: floor.name,
            index: floor.level,
          },
        })
        .from(room)
        .leftJoin(floor, eq(floor.id, room.floorId))
        .where(eq(room.homeId, homeId))
        .orderBy(room.name);

      // Get floors
      const floors = await db
        .select()
        .from(floor)
        .where(eq(floor.homeId, homeId))
        .orderBy(floor.level);

      return {
        ...homeInfo,
        deviceCount: deviceCountResult[0]?.count || 0,
        entityCount: entityCountResult[0]?.count || 0,
        rooms,
        floors,
      };
    }),

  /**
   * Get rooms in home
   */
  getRooms: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { homeId } = input;

      const result = await db
        .select({
          roomId: room.id,
          name: room.name,
          floorId: room.floorId,
          floor: {
            floorId: floor.id,
            name: floor.name,
            index: floor.level,
          },
        })
        .from(room)
        .leftJoin(floor, eq(floor.id, room.floorId))
        .where(eq(room.homeId, homeId))
        .orderBy(room.name);

      return result;
    }),

  /**
   * Create a new room
   */
  createRoom: protectedProcedure
    .input(z.object({
      homeId: z.string(),
      name: z.string().min(1),
      floorId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { homeId, name, floorId } = input;

      const result = await db
        .insert(room)
        .values({
          homeId,
          name,
          floorId,
        })
        .returning();

      return result[0];
    }),

  /**
   * Get floors in home
   */
  getFloors: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { homeId } = input;

      const result = await db
        .select()
        .from(floor)
        .where(eq(floor.homeId, homeId))
        .orderBy(floor.level);

      return result;
    }),

  /**
   * Create a new floor
   */
  createFloor: protectedProcedure
    .input(z.object({
      homeId: z.string(),
      name: z.string().min(1),
      index: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const { homeId, name, index } = input;

      const result = await db
        .insert(floor)
        .values({
          homeId,
          name,
          index,
        })
        .returning();

      return result[0];
    }),

  /**
   * Get devices in home
   */
  getDevices: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { homeId } = input;

      const result = await db
        .select({
          deviceId: device.id,
          name: device.name,
          manufacturer: device.manufacturer,
          model: device.model,
          swVersion: device.swVersion,
          ipAddr: device.ipAddress,
          roomId: device.roomId,
          room: {
            roomId: room.id,
            name: room.name,
          },
          entityCount: count(entity.id),
        })
        .from(device)
        .leftJoin(room, eq(room.id, device.roomId))
        .leftJoin(entity, eq(entity.deviceId, device.id))
        .where(eq(device.homeId, homeId))
        .groupBy(
          device.id,
          device.name,
          device.manufacturer,
          device.model,
          device.swVersion,
          device.ipAddress,
          device.roomId,
          room.id,
          room.name,
        )
        .orderBy(device.name);

      return result;
    }),

  /**
   * Get entities in home
   */
  getEntities: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { homeId } = input;

      const result = await db
        .select({
          entityId: entity.id,
          deviceId: entity.deviceId,
          kind: entity.kind,
          key: entity.key,
          traits: entity.traits,
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
        .innerJoin(device, eq(device.id, entity.deviceId))
        .leftJoin(room, eq(room.id, device.roomId))
        .where(eq(device.homeId, homeId))
        .orderBy(entity.key);

      return result;
    }),

  /**
   * Get home summary statistics
   */
  getSummary: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { homeId } = input;

      // Get counts by entity kind
      const entityKindCounts = await db
        .select({
          kind: entity.kind,
          count: count(),
        })
        .from(entity)
        .innerJoin(device, eq(device.id, entity.deviceId))
        .where(eq(device.homeId, homeId))
        .groupBy(entity.kind);

      // Get device counts by room
      const roomDeviceCounts = await db
        .select({
          roomId: room.id,
          roomName: room.name,
          count: count(device.id),
        })
        .from(room)
        .leftJoin(device, eq(device.roomId, room.id))
        .where(eq(room.homeId, homeId))
        .groupBy(room.id, room.name);

      return {
        entityKindCounts,
        roomDeviceCounts,
      };
    }),
});


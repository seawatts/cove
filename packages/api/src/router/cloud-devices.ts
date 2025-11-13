/**
 * Cloud Devices Router
 * Query mirrored device data from cloud Postgres database
 * Mirrors hub API structure for seamless fallback
 */

import { devices, entities, hubs } from '@cove/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const cloudDevicesRouter = createTRPCRouter({
  /**
   * Get a single device by ID with room info
   * Mirrors hub API: hubApi.device.get
   */
  get: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const device = await ctx.db.query.devices.findFirst({
        where: eq(devices.id, input.deviceId),
        with: {
          room: true,
        },
      });

      if (!device) {
        throw new Error('Device not found');
      }

      // Verify user has access to this hub
      if (device.hubId) {
        const hub = await ctx.db.query.hubs.findFirst({
          where: eq(hubs.id, device.hubId),
        });

        if (hub && hub.ownerId !== ctx.auth.userId) {
          throw new Error('Unauthorized');
        }
      }

      return device;
    }),

  /**
   * Get entities for a device with their current states
   * Mirrors hub API: hubApi.device.getEntities
   */
  getEntities: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // First verify device access
      const device = await ctx.db.query.devices.findFirst({
        where: eq(devices.id, input.deviceId),
      });

      if (!device) {
        throw new Error('Device not found');
      }

      // Verify user has access
      if (device.hubId) {
        const hub = await ctx.db.query.hubs.findFirst({
          where: eq(hubs.id, device.hubId),
        });

        if (hub && hub.ownerId !== ctx.auth.userId) {
          throw new Error('Unauthorized');
        }
      }

      // Get entities with their states
      const deviceEntities = await ctx.db.query.entities.findMany({
        where: eq(entities.deviceId, input.deviceId),
        with: {
          state: true,
        },
      });

      // Transform to match hub API response format
      return deviceEntities.map((entity) => ({
        ...entity,
        currentState: entity.state
          ? {
              attrs: entity.state.attrs,
              state: entity.state.state,
              updatedAt: entity.state.updatedAt,
            }
          : null,
      }));
    }),

  /**
   * List devices by hub
   * Mirrors hub API: hubApi.device.list
   */
  list: protectedProcedure
    .input(z.object({ hubId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to this hub
      const hub = await ctx.db.query.hubs.findFirst({
        where: eq(hubs.id, input.hubId),
      });

      if (!hub) {
        throw new Error('Hub not found');
      }

      if (hub.ownerId !== ctx.auth.userId) {
        throw new Error('Unauthorized');
      }

      // Get devices for this hub
      const hubDevices = await ctx.db.query.devices.findMany({
        where: eq(devices.hubId, input.hubId),
        with: {
          room: true,
        },
      });

      return hubDevices;
    }),

  /**
   * List devices by home (legacy support)
   * Note: With multi-hub support, this may return devices from multiple hubs
   */
  listByHome: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const homeDevices = await ctx.db.query.devices.findMany({
        where: eq(devices.homeId, input.homeId),
        with: {
          hub: true,
          room: true,
        },
      });

      // Filter to only devices from hubs the user owns
      const userHubIds = await ctx.db
        .select({ id: hubs.id })
        .from(hubs)
        .where(eq(hubs.ownerId, ctx.auth.userId));

      const hubIdSet = new Set(userHubIds.map((h) => h.id));

      return homeDevices.filter(
        (device) => !device.hubId || hubIdSet.has(device.hubId),
      );
    }),

  /**
   * Sync device from hub to cloud
   * Called by hub's CloudSyncService
   */
  sync: publicProcedure
    .input(
      z.object({
        device: z.object({
          available: z.boolean().optional(),
          categories: z.array(z.string()).optional(),
          configUrl: z.string().optional(),
          disabledBy: z.string().optional(),
          entryType: z.string().optional(),
          externalId: z.string().optional(),
          homeId: z.string(),
          hostname: z.string().optional(),
          hubId: z.string(),
          hwVersion: z.string().optional(),
          id: z.string(),
          ipAddress: z.string().optional(),
          lastSeen: z.date().optional(),
          macAddress: z.string().optional(),
          manufacturer: z.string().optional(),
          matterNodeId: z.number().optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          model: z.string().optional(),
          name: z.string(),
          online: z.boolean().optional(),
          port: z.number().optional(),
          protocol: z.string(),
          roomId: z.string().optional(),
          swVersion: z.string().optional(),
          type: z.string().optional(),
          viaDeviceId: z.string().optional(),
        }),
        hubId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { device, hubId } = input;

      // Verify hub exists
      const hub = await ctx.db.query.hubs.findFirst({
        where: eq(hubs.id, hubId),
      });

      if (!hub) {
        throw new Error('Hub not found');
      }

      // Upsert device (insert or update)
      const existing = await ctx.db.query.devices.findFirst({
        where: eq(devices.id, device.id),
      });

      if (existing) {
        // Update existing device
        await ctx.db
          .update(devices)
          .set({
            ...device,
            hubId,
            updatedAt: new Date(),
          })
          .where(eq(devices.id, device.id));
      } else {
        // Insert new device
        await ctx.db.insert(devices).values({
          ...device,
          createdAt: new Date(),
          hubId,
          updatedAt: new Date(),
        });
      }

      return { success: true };
    }),
});

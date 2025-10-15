import { and, asc, desc, eq, gte, sql } from '@cove/db';
import { Devices, States } from '@cove/db/schema';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const deviceRouter = createTRPCRouter({
  // Clean up duplicate devices (keeps the most recent one per IP+protocol combination)
  cleanupDuplicates: protectedProcedure.mutation(async ({ ctx }) => {
    // Get all devices for the user
    const allDevices = await ctx.db.query.Devices.findMany({
      orderBy: (devices) => [desc(devices.createdAt)],
      where: eq(Devices.userId, ctx.auth.userId),
    });

    // Group devices by IP + protocol
    const deviceGroups = new Map<string, typeof allDevices>();
    for (const device of allDevices) {
      if (device.ipAddress && device.protocol) {
        const key = `${device.ipAddress}:${device.protocol}`;
        const group = deviceGroups.get(key) || [];
        group.push(device);
        deviceGroups.set(key, group);
      }
    }

    // Find duplicates (groups with more than one device)
    let deletedCount = 0;
    for (const [, group] of deviceGroups) {
      if (group.length > 1) {
        // Keep the first one (most recent), delete the rest
        const [_keep, ...toDelete] = group;
        for (const device of toDelete) {
          await ctx.db.delete(Devices).where(eq(Devices.id, device.id));
          deletedCount++;
        }
      }
    }

    return {
      deletedCount,
      message: `Removed ${deletedCount} duplicate device(s)`,
    };
  }),
  // Create a new device (or update if it already exists)
  create: protectedProcedure
    .input(
      z.object({
        capabilities: z.array(z.string()).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        deviceType: z.enum([
          'light',
          'switch',
          'sensor',
          'thermostat',
          'lock',
          'camera',
          'speaker',
          'fan',
          'outlet',
          'hub',
          'other',
        ]),
        hubId: z.string().optional(),
        ipAddress: z.string().optional(),
        name: z.string(),
        protocol: z
          .enum([
            'esphome',
            'hue',
            'matter',
            'zigbee',
            'zwave',
            'wifi',
            'bluetooth',
            'mqtt',
            'http',
          ])
          .optional(),
        roomId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if a device with the same IP + protocol already exists for this user
      // This prevents duplicate devices from being created
      if (input.ipAddress && input.protocol) {
        const existingDevice = await ctx.db.query.Devices.findFirst({
          where: and(
            eq(Devices.userId, ctx.auth.userId),
            eq(Devices.ipAddress, input.ipAddress),
            eq(Devices.protocol, input.protocol),
          ),
        });

        if (existingDevice) {
          // Update the existing device instead of creating a duplicate
          const [updatedDevice] = await ctx.db
            .update(Devices)
            .set({
              available: true,
              capabilities: input.capabilities || existingDevice.capabilities,
              config: { ...existingDevice.config, ...input.config },
              deviceType: input.deviceType,
              hubId: input.hubId,
              name: input.name,
              online: true,
              roomId: input.roomId,
            })
            .where(eq(Devices.id, existingDevice.id))
            .returning();

          return updatedDevice;
        }
      }

      // No existing device found, create a new one
      // Generate external ID based on protocol and available identifiers
      const sanitizedIp =
        input.ipAddress?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';
      const sanitizedName = input.name
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();
      const externalId = input.ipAddress
        ? `${input.protocol}_ip_${sanitizedIp}`
        : `${input.protocol}_name_${sanitizedName}_${Date.now()}`;

      const [device] = await ctx.db
        .insert(Devices)
        .values({
          available: true,
          capabilities: input.capabilities || [],
          config: input.config || {},
          deviceType: input.deviceType,
          externalId,
          hubId: input.hubId,
          ipAddress: input.ipAddress,
          name: input.name,
          online: true,
          orgId: ctx.auth.orgId,
          protocol: input.protocol,
          roomId: input.roomId,
          state: {},
          userId: ctx.auth.userId,
        })
        .returning();

      return device;
    }),

  // Delete a device
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(Devices).where(eq(Devices.id, input.id));
      return { success: true };
    }),

  // Get a specific device with recent state history
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const device = await ctx.db.query.Devices.findFirst({
        where: eq(Devices.id, input.id),
        with: {
          room: true,
        },
      });

      if (!device) {
        throw new Error('Device not found');
      }

      // Get recent state history (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const stateHistory = await ctx.db.query.States.findMany({
        limit: 100,
        orderBy: (history) => [desc(history.lastChanged)],
        where: and(
          eq(States.deviceId, input.id),
          gte(States.lastChanged, oneDayAgo),
        ),
      });

      return {
        ...device,
        recentStateHistory: stateHistory,
      };
    }),

  // Get state history for time-series queries and graphs
  getStateHistory: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        limit: z.number().min(1).max(1000).optional().default(500),
        stateKey: z.string().optional(), // Filter by specific sensor (e.g., 'co2', 'temperature')
        timeRange: z.enum(['24h', '7d', '30d']).optional().default('24h'),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Calculate time range
      const timeRangeMs = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      const fromDate = new Date(Date.now() - timeRangeMs[input.timeRange]);

      const conditions = [
        eq(States.deviceId, input.deviceId),
        gte(States.lastChanged, fromDate),
      ];

      // Filter by specific sensor if stateKey is provided
      if (input.stateKey) {
        conditions.push(
          sql`${States.attributes}->>'stateKey' = ${input.stateKey}`,
        );
      }

      const stateHistory = await ctx.db.query.States.findMany({
        limit: input.limit,
        orderBy: (history) => [asc(history.lastChanged)], // Ascending for time-series charts
        where: and(...conditions),
      });

      return stateHistory;
    }),

  // List all devices for the current user
  list: protectedProcedure
    .input(
      z
        .object({
          hubId: z.string().optional(),
          roomId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(Devices.userId, ctx.auth.userId)];

      if (input?.roomId) {
        conditions.push(eq(Devices.roomId, input.roomId));
      }

      if (input?.hubId) {
        conditions.push(eq(Devices.hubId, input.hubId));
      }

      return ctx.db.query.Devices.findMany({
        orderBy: (devices) => [desc(devices.lastSeen)],
        where: and(...conditions),
        with: {
          room: true,
        },
      });
    }),

  // Update device configuration
  updateConfig: protectedProcedure
    .input(
      z.object({
        config: z.record(z.string(), z.unknown()).optional(),
        id: z.string(),
        name: z.string().optional(),
        roomId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.roomId !== undefined) updateData.roomId = input.roomId;
      if (input.config !== undefined) updateData.config = input.config;

      const [updated] = await ctx.db
        .update(Devices)
        .set(updateData)
        .where(eq(Devices.id, input.id))
        .returning();

      return updated;
    }),

  // Update device state
  updateState: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        state: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(Devices)
        .set({
          lastSeen: new Date(),
          state: input.state,
        })
        .where(eq(Devices.id, input.id))
        .returning();

      return updated;
    }),
});

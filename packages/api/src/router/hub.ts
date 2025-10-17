import { and, desc, eq, gte } from '@cove/db';
import { DeviceEvents, DeviceStateHistory, Devices } from '@cove/db/schema';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const hubRouter = createTRPCRouter({
  // Delete a hub (now deletes hub device)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Delete hub device (cascade will delete managed devices, events, metrics)
      await ctx.db
        .delete(Devices)
        .where(and(eq(Devices.id, input.id), eq(Devices.deviceType, 'hub')));
      return { success: true };
    }),

  // Get a specific hub (query as device)
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.device.findFirst({
        where: and(eq(Devices.id, input.id), eq(Devices.deviceType, 'hub')),
        with: {
          managedDevices: true, // Get all devices managed by this hub
        },
      });
    }),

  // Get hub events (activity feed) - queries DeviceEvents for hub device
  getEvents: protectedProcedure
    .input(
      z.object({
        eventType: z.string().optional(),
        hubId: z.string(), // Now this is the hub's device ID
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
        severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
        since: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify this is actually a hub device
      const hubDevice = await ctx.db.query.device.findFirst({
        where: and(eq(Devices.id, input.hubId), eq(Devices.deviceType, 'hub')),
      });

      if (!hubDevice) {
        return {
          events: [],
          limit: input.limit,
          offset: input.offset,
        };
      }

      const whereConditions = [eq(DeviceEvents.deviceId, input.hubId)];

      if (input.severity) {
        whereConditions.push(eq(DeviceEvents.severity, input.severity));
      }

      if (input.since) {
        whereConditions.push(gte(DeviceEvents.timestamp, input.since));
      }

      const events = await ctx.db.query.DeviceEvents.findMany({
        limit: input.limit,
        offset: input.offset,
        orderBy: [desc(DeviceEvents.timestamp)],
        where:
          whereConditions.length > 1
            ? and(...whereConditions)
            : whereConditions[0],
      });

      return {
        events,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  // Get hub logs (proxy to hub daemon)
  getLogs: protectedProcedure
    .input(
      z.object({
        hubId: z.string(), // Hub's device ID
        lines: z.number().min(1).max(1000).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get hub device to find its API endpoint
      const hubDevice = await ctx.db.query.device.findFirst({
        where: and(eq(Devices.id, input.hubId), eq(Devices.deviceType, 'hub')),
      });

      if (!hubDevice || !hubDevice.online) {
        throw new Error('Hub not found or offline');
      }

      // Extract apiPort from device config
      const apiPort =
        ((hubDevice.config as Record<string, unknown> | undefined)?.apiPort as
          | number
          | undefined) || 3100;
      const hubUrl = `http://${hubDevice.ipAddress}:${apiPort}`;

      try {
        const response = await fetch(
          `${hubUrl}/api/hub/logs?lines=${input.lines}`,
        );

        if (!response.ok) {
          throw new Error('Failed to fetch logs from hub');
        }

        const data = await response.json();
        return data;
      } catch (error) {
        throw new Error(`Failed to connect to hub: ${error}`);
      }
    }),

  // Get hub metrics (time-series) - queries DeviceStateHistory for hub device
  getMetrics: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        hubId: z.string(), // Now this is the hub's device ID
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
        to: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify this is actually a hub device
      const hubDevice = await ctx.db.query.device.findFirst({
        where: and(eq(Devices.id, input.hubId), eq(Devices.deviceType, 'hub')),
      });

      if (!hubDevice) {
        return {
          limit: input.limit,
          offset: input.offset,
          stateHistory: [],
        };
      }

      const whereConditions = [eq(DeviceStateHistory.deviceId, input.hubId)];

      if (input.from) {
        whereConditions.push(gte(DeviceStateHistory.lastChanged, input.from));
      }

      const stateHistory = await ctx.db.query.DeviceStateHistory.findMany({
        limit: input.limit,
        offset: input.offset,
        orderBy: [desc(DeviceStateHistory.lastChanged)],
        where:
          whereConditions.length > 1
            ? and(...whereConditions)
            : whereConditions[0],
      });

      return {
        limit: input.limit,
        offset: input.offset,
        stateHistory,
      };
    }),

  // List all hubs for the current user (query devices with deviceType='hub')
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.device.findMany({
      orderBy: (devices, { desc }) => [desc(devices.lastSeen)],
      where: and(
        eq(Devices.userId, ctx.auth.userId),
        eq(Devices.deviceType, 'hub'),
      ),
    });
  }),

  // Update hub configuration (updates device config field)
  updateConfig: protectedProcedure
    .input(
      z.object({
        config: z.object({
          apiPort: z.number().optional(),
          autoUpdate: z.boolean().optional(),
          discoveryEnabled: z.boolean().optional(),
          discoveryInterval: z.number().optional(),
          enabledProtocols: z.array(z.string()).optional(),
          telemetryInterval: z.number().optional(),
          updateChannel: z.enum(['stable', 'beta', 'dev']).optional(),
          wsPort: z.number().optional(),
        }),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch existing hub device to merge config
      const existingHub = await ctx.db.query.device.findFirst({
        where: and(eq(Devices.id, input.id), eq(Devices.deviceType, 'hub')),
      });

      if (!existingHub) {
        throw new Error('Hub not found');
      }

      const [updated] = await ctx.db
        .update(Devices)
        .set({
          config: {
            ...existingHub.config,
            ...input.config,
          },
        })
        .where(eq(Devices.id, input.id))
        .returning();

      return updated;
    }),
});

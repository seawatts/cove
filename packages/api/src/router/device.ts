import { DeviceMetrics, Devices } from '@cove/db/schema';
import { and, desc, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const deviceRouter = createTRPCRouter({
  // Delete a device
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(Devices).where(eq(Devices.id, input.id));
      return { success: true };
    }),

  // Get a specific device with recent metrics
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const device = await ctx.db.query.Devices.findFirst({
        where: eq(Devices.id, input.id),
        with: {
          hub: true,
          room: true,
        },
      });

      if (!device) {
        throw new Error('Device not found');
      }

      // Get recent metrics (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const metrics = await ctx.db.query.DeviceMetrics.findMany({
        limit: 100,
        orderBy: (metrics) => [desc(metrics.timestamp)],
        where: and(
          eq(DeviceMetrics.deviceId, input.id),
          gte(DeviceMetrics.timestamp, oneDayAgo),
        ),
      });

      return {
        ...device,
        recentMetrics: metrics,
      };
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
          hub: true,
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

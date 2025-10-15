/**
 * ESPHome API Router
 * Handles entity queries and device control commands for ESPHome devices
 */

import { and, eq } from '@cove/db';
import { Commands, Devices, Entities } from '@cove/db/schema';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const esphomeRouter = createTRPCRouter({
  // Control light
  controlLight: protectedProcedure
    .input(
      z.object({
        command: z.object({
          brightness: z.number().min(0).max(1).optional(),
          effect: z.string().optional(),
          rgb: z.array(z.number()).length(3).optional(),
          state: z.boolean().optional(),
        }),
        deviceId: z.string(),
        entityKey: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify device exists and belongs to the user
      const device = await ctx.db.query.Devices.findFirst({
        where: and(
          eq(Devices.id, input.deviceId),
          eq(Devices.userId, ctx.auth.userId),
        ),
      });

      if (!device) {
        throw new Error('Device not found');
      }

      await ctx.db.insert(Commands).values({
        capability: 'light_control',
        deviceId: input.deviceId,
        status: 'pending',
        value: { entityKey: input.entityKey, ...input.command },
      });

      return { success: true };
    }),
  // Get entities for a device
  getEntities: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify device exists and belongs to the user
      const device = await ctx.db.query.Devices.findFirst({
        where: and(
          eq(Devices.id, input.deviceId),
          eq(Devices.userId, ctx.auth.userId),
        ),
      });

      if (!device) {
        throw new Error('Device not found');
      }

      return ctx.db.query.Entities.findMany({
        orderBy: (entities, { asc }) => [
          asc(entities.entityType),
          asc(entities.name),
        ],
        where: eq(Entities.deviceId, input.deviceId),
      });
    }),

  // Press button
  pressButton: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        entityKey: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify device exists and belongs to the user
      const device = await ctx.db.query.Devices.findFirst({
        where: and(
          eq(Devices.id, input.deviceId),
          eq(Devices.userId, ctx.auth.userId),
        ),
      });

      if (!device) {
        throw new Error('Device not found');
      }

      // Queue command for hub daemon
      await ctx.db.insert(Commands).values({
        capability: 'button_press',
        deviceId: input.deviceId,
        status: 'pending',
        value: { entityKey: input.entityKey },
      });

      return { success: true };
    }),

  // Set number value
  setNumber: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        entityKey: z.number(),
        value: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify device exists and belongs to the user
      const device = await ctx.db.query.Devices.findFirst({
        where: and(
          eq(Devices.id, input.deviceId),
          eq(Devices.userId, ctx.auth.userId),
        ),
      });

      if (!device) {
        throw new Error('Device not found');
      }

      await ctx.db.insert(Commands).values({
        capability: 'number_set',
        deviceId: input.deviceId,
        status: 'pending',
        value: { entityKey: input.entityKey, value: input.value },
      });

      return { success: true };
    }),
});

/**
 * Home Router
 * Handles home and household management for Home Assistant-inspired architecture
 */

import { devices, entities, homes, rooms } from '@cove/db/schema';
import { count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const homeRouter = createTRPCRouter({
  /**
   * Create a new home
   */
  create: protectedProcedure
    .input(
      z.object({
        address: z.record(z.string(), z.unknown()).optional(),
        name: z.string().min(1),
        timezone: z.string().default('America/Los_Angeles'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [newHome] = await ctx.db
        .insert(homes)
        .values({
          address: input.address,
          createdBy: ctx.auth.userId,
          name: input.name,
          timezone: input.timezone,
        })
        .returning();

      return newHome;
    }),

  /**
   * Delete a home
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(homes).where(eq(homes.id, input.id));
      return { success: true };
    }),

  /**
   * Get current user's home
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    // For now, we'll get the first home
    // In a real implementation, this would be based on user authentication
    const result = await ctx.db
      .select({
        address: homes.address,
        createdAt: homes.createdAt,
        id: homes.id,
        name: homes.name,
        timezone: homes.timezone,
        updatedAt: homes.updatedAt,
      })
      .from(homes)
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0];
  }),

  /**
   * Get home statistics
   */
  getStats: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { homeId } = input;

      // Get device count
      const deviceCount = await ctx.db
        .select({ count: count() })
        .from(devices)
        .where(eq(devices.homeId, homeId));

      // Get entity count
      const entityCount = await ctx.db
        .select({ count: count() })
        .from(entities)
        .leftJoin(devices, eq(devices.id, entities.deviceId))
        .where(eq(devices.homeId, homeId));

      // Get room count
      const roomCount = await ctx.db
        .select({ count: count() })
        .from(rooms)
        .where(eq(rooms.homeId, homeId));

      return {
        deviceCount: deviceCount[0]?.count || 0,
        entityCount: entityCount[0]?.count || 0,
        roomCount: roomCount[0]?.count || 0,
      };
    }),

  /**
   * Update a home
   */
  update: protectedProcedure
    .input(
      z.object({
        address: z.record(z.string(), z.unknown()).optional(),
        id: z.string(),
        name: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [updatedHome] = await ctx.db
        .update(homes)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(homes.id, id))
        .returning();

      return updatedHome;
    }),
});

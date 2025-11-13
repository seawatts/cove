/**
 * Hub Registry Router
 * Handles hub registration, heartbeat, and status updates for cloud mirroring
 */

import { hubs } from '@cove/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const hubRegistryRouter = createTRPCRouter({
  /**
   * Delete hub
   * Cascades to delete all associated devices, entities, etc.
   */
  delete: protectedProcedure
    .input(z.object({ hubId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership first
      const [existingHub] = await ctx.db
        .select()
        .from(hubs)
        .where(eq(hubs.id, input.hubId))
        .limit(1);

      if (!existingHub) {
        throw new Error('Hub not found');
      }

      if (existingHub.ownerId !== ctx.auth.userId) {
        throw new Error('Unauthorized');
      }

      await ctx.db.delete(hubs).where(eq(hubs.id, input.hubId));

      return { success: true };
    }),

  /**
   * Get specific hub details
   */
  get: protectedProcedure
    .input(z.object({ hubId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [hub] = await ctx.db
        .select()
        .from(hubs)
        .where(eq(hubs.id, input.hubId))
        .limit(1);

      if (!hub) {
        throw new Error('Hub not found');
      }

      // Verify ownership
      if (hub.ownerId !== ctx.auth.userId) {
        throw new Error('Unauthorized');
      }

      return hub;
    }),

  /**
   * Update hub heartbeat and status
   * Called by hub periodically (e.g., every 30 seconds)
   */
  heartbeat: publicProcedure
    .input(
      z.object({
        cloudUrl: z.string().optional(),
        hubId: z.string(),
        online: z.boolean().default(true),
        version: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { hubId, ...updates } = input;

      const [updatedHub] = await ctx.db
        .update(hubs)
        .set({
          ...updates,
          lastSeen: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(hubs.id, hubId))
        .returning();

      return updatedHub;
    }),

  /**
   * Get user's hubs
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const userHubs = await ctx.db
      .select()
      .from(hubs)
      .where(eq(hubs.ownerId, ctx.auth.userId));

    return userHubs;
  }),

  /**
   * Mark hub as offline
   * Called by hub on graceful shutdown
   */
  offline: publicProcedure
    .input(z.object({ hubId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updatedHub] = await ctx.db
        .update(hubs)
        .set({
          lastSeen: new Date(),
          online: false,
          updatedAt: new Date(),
        })
        .where(eq(hubs.id, input.hubId))
        .returning();

      return updatedHub;
    }),
  /**
   * Register a new hub or update existing hub
   * Called by hub on startup
   */
  register: publicProcedure
    .input(
      z.object({
        cloudUrl: z.string().optional(),
        hubId: z.string().optional(), // If provided, update existing hub
        localUrl: z.string().url(),
        name: z.string().min(1),
        ownerId: z.string(),
        version: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { hubId, ...hubData } = input;

      // If hubId provided, update existing hub
      if (hubId) {
        const [updatedHub] = await ctx.db
          .update(hubs)
          .set({
            ...hubData,
            lastSeen: new Date(),
            online: true,
            updatedAt: new Date(),
          })
          .where(eq(hubs.id, hubId))
          .returning();

        return updatedHub;
      }

      // Otherwise, create new hub
      const [newHub] = await ctx.db
        .insert(hubs)
        .values({
          ...hubData,
          lastSeen: new Date(),
          online: true,
        })
        .returning();

      return newHub;
    }),

  /**
   * Update hub settings (name, URLs)
   */
  update: protectedProcedure
    .input(
      z.object({
        cloudUrl: z.string().optional(),
        hubId: z.string(),
        localUrl: z.string().url().optional(),
        name: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { hubId, ...updates } = input;

      // Verify ownership first
      const [existingHub] = await ctx.db
        .select()
        .from(hubs)
        .where(eq(hubs.id, hubId))
        .limit(1);

      if (!existingHub) {
        throw new Error('Hub not found');
      }

      if (existingHub.ownerId !== ctx.auth.userId) {
        throw new Error('Unauthorized');
      }

      // Update hub
      const [updatedHub] = await ctx.db
        .update(hubs)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(hubs.id, hubId))
        .returning();

      return updatedHub;
    }),
});

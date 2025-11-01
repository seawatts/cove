/**
 * Entity Router
 * Entity queries and command mutations
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const entityRouter = createTRPCRouter({
  /**
   * Send command to an entity
   */
  command: publicProcedure
    .input(
      z.object({
        capability: z.string(),
        entityId: z.string(),
        userId: z.string().optional(),
        value: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.daemon.processCommand({
        capability: input.capability,
        entityId: input.entityId,
        userId: input.userId,
        value: input.value,
      });

      return result;
    }),

  /**
   * Get a single entity by ID with its current state
   */
  get: publicProcedure
    .input(z.object({ entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const registry = ctx.daemon.getRegistry();
      if (!registry) {
        throw new Error('Registry not available');
      }

      const entity = await registry.getEntity(input.entityId);
      if (!entity) {
        throw new Error('Entity not found');
      }

      // Get entity state separately
      const stateStore = ctx.daemon.getStateStore();
      if (!stateStore) {
        return { ...entity, state: null };
      }

      const state = await stateStore.getEntityState(input.entityId);

      return { ...entity, state };
    }),
  /**
   * List entities with optional filters
   */
  list: publicProcedure
    .input(
      z.object({
        deviceId: z.string().optional(),
        homeId: z.string().optional(),
        kind: z.string().optional(),
        roomId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filters: Record<string, string> = {};
      if (input.homeId) filters.homeId = input.homeId;
      if (input.roomId) filters.roomId = input.roomId;
      if (input.kind) filters.kind = input.kind;
      if (input.deviceId) filters.deviceId = input.deviceId;

      const entities = await ctx.daemon.getEntities(filters);
      return entities;
    }),

  /**
   * Send command to an entity (alias for command to match web app expectations)
   */
  sendCommand: publicProcedure
    .input(
      z.object({
        capability: z.string(),
        entityId: z.string(),
        userId: z.string().optional(),
        value: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.daemon.processCommand({
        capability: input.capability,
        entityId: input.entityId,
        userId: input.userId,
        value: input.value,
      });

      return result;
    }),
});

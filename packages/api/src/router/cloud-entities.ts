/**
 * Cloud Entities Router
 * Query mirrored entity data from cloud Postgres database
 * Mirrors hub API structure for seamless fallback
 */

import { entities, entityStates, hubs } from '@cove/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const cloudEntitiesRouter = createTRPCRouter({
  /**
   * Get a single entity by ID with its current state
   * Mirrors hub API: hubApi.entity.get
   */
  get: protectedProcedure
    .input(z.object({ entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const entity = await ctx.db.query.entities.findFirst({
        where: eq(entities.id, input.entityId),
        with: {
          device: true,
          state: true,
        },
      });

      if (!entity) {
        throw new Error('Entity not found');
      }

      // Verify user has access to this hub
      if (entity.hubId) {
        const hub = await ctx.db.query.hubs.findFirst({
          where: eq(hubs.id, entity.hubId),
        });

        if (hub && hub.ownerId !== ctx.auth.userId) {
          throw new Error('Unauthorized');
        }
      }

      return {
        ...entity,
        state: entity.state || null,
      };
    }),

  /**
   * Get entity state
   * Mirrors hub API: hubApi.entity.getState
   */
  getState: protectedProcedure
    .input(z.object({ entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      // First verify entity access
      const entity = await ctx.db.query.entities.findFirst({
        where: eq(entities.id, input.entityId),
      });

      if (!entity) {
        throw new Error('Entity not found');
      }

      // Verify user has access
      if (entity.hubId) {
        const hub = await ctx.db.query.hubs.findFirst({
          where: eq(hubs.id, entity.hubId),
        });

        if (hub && hub.ownerId !== ctx.auth.userId) {
          throw new Error('Unauthorized');
        }
      }

      // Get state
      const state = await ctx.db.query.entityStates.findFirst({
        where: eq(entityStates.entityId, input.entityId),
      });

      return state;
    }),

  /**
   * List entities with optional filters
   * Mirrors hub API: hubApi.entity.list
   */
  list: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().optional(),
        homeId: z.string().optional(),
        hubId: z.string().optional(),
        kind: z.string().optional(),
        roomId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // If hubId provided, verify access
      if (input.hubId) {
        const hub = await ctx.db.query.hubs.findFirst({
          where: eq(hubs.id, input.hubId),
        });

        if (!hub) {
          throw new Error('Hub not found');
        }

        if (hub.ownerId !== ctx.auth.userId) {
          throw new Error('Unauthorized');
        }
      }

      // Build where conditions
      const conditions = [];
      if (input.hubId) conditions.push(eq(entities.hubId, input.hubId));
      if (input.deviceId)
        conditions.push(eq(entities.deviceId, input.deviceId));
      if (input.kind) conditions.push(eq(entities.kind, input.kind));

      const entityList = await ctx.db.query.entities.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          device: input.deviceId
            ? false
            : {
                with: {
                  room: true,
                },
              },
          state: true,
        },
      });

      // Filter by user's hubs
      const userHubIds = await ctx.db
        .select({ id: hubs.id })
        .from(hubs)
        .where(eq(hubs.ownerId, ctx.auth.userId));

      const hubIdSet = new Set(userHubIds.map((h) => h.id));

      return entityList.filter(
        (entity) => !entity.hubId || hubIdSet.has(entity.hubId),
      );
    }),

  /**
   * Sync entity from hub to cloud
   * Called by hub's CloudSyncService
   */
  sync: publicProcedure
    .input(
      z.object({
        entity: z.object({
          capabilities: z.array(z.unknown()).optional(),
          deviceClass: z.string().optional(),
          deviceId: z.string(),
          displayName: z.string().optional(),
          hubId: z.string(),
          id: z.string(),
          isFavorite: z.boolean().optional(),
          key: z.string(),
          kind: z.string(),
          name: z.string().optional(),
        }),
        hubId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { entity, hubId } = input;

      // Verify hub exists
      const hub = await ctx.db.query.hubs.findFirst({
        where: eq(hubs.id, hubId),
      });

      if (!hub) {
        throw new Error('Hub not found');
      }

      // Upsert entity
      const existing = await ctx.db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
      });

      if (existing) {
        await ctx.db
          .update(entities)
          .set({
            ...entity,
            hubId,
          })
          .where(eq(entities.id, entity.id));
      } else {
        await ctx.db.insert(entities).values({
          ...entity,
          hubId,
        });
      }

      return { success: true };
    }),

  /**
   * Sync entity state from hub to cloud
   * Called by hub's CloudSyncService
   */
  syncState: publicProcedure
    .input(
      z.object({
        entityId: z.string(),
        hubId: z.string(),
        state: z.object({
          attrs: z.record(z.unknown()).optional(),
          state: z.unknown(),
          updatedAt: z.date().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { entityId, hubId, state } = input;

      // Verify hub exists
      const hub = await ctx.db.query.hubs.findFirst({
        where: eq(hubs.id, hubId),
      });

      if (!hub) {
        throw new Error('Hub not found');
      }

      // Verify entity exists
      const entity = await ctx.db.query.entities.findFirst({
        where: eq(entities.id, entityId),
      });

      if (!entity) {
        throw new Error('Entity not found');
      }

      // Upsert entity state
      const existingState = await ctx.db.query.entityStates.findFirst({
        where: eq(entityStates.entityId, entityId),
      });

      if (existingState) {
        await ctx.db
          .update(entityStates)
          .set({
            attrs: state.attrs || null,
            state: state.state,
            updatedAt: state.updatedAt || new Date(),
          })
          .where(eq(entityStates.entityId, entityId));
      } else {
        await ctx.db.insert(entityStates).values({
          attrs: state.attrs || null,
          entityId,
          state: state.state,
          updatedAt: state.updatedAt || new Date(),
        });
      }

      return { success: true };
    }),
});

import { eq } from '@cove/db';
import { rooms } from '@cove/db/schema';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const roomRouter = createTRPCRouter({
  // Create a new room
  create: protectedProcedure
    .input(
      z.object({
        floorId: z.number().optional(),
        homeId: z.string(),
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [newRoom] = await ctx.db
        .insert(rooms)
        .values({
          floor: input.floorId,
          homeId: input.homeId,
          name: input.name,
        })
        .returning();

      return newRoom;
    }),

  // Delete a room
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(rooms).where(eq(rooms.id, input.id));
      return { success: true };
    }),

  // Get a specific room with devices
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.rooms.findFirst({
        where: eq(rooms.id, input.id),
        with: {
          devices: true,
        },
      });
    }),

  // List all rooms for a home
  list: protectedProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.rooms.findMany({
        orderBy: (rooms, { asc }) => [asc(rooms.name)],
        where: eq(rooms.homeId, input.homeId),
        with: {
          devices: {
            columns: {
              id: true,
              manufacturer: true,
              model: true,
              name: true,
              online: true,
            },
          },
        },
      });
    }),

  /**
   * Sync room from hub to cloud
   * Called by hub's CloudSyncService
   */
  sync: publicProcedure
    .input(
      z.object({
        hubId: z.string(),
        room: z.object({
          floor: z.number().optional(),
          homeId: z.string(),
          hubId: z.string(),
          id: z.string(),
          name: z.string(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { room, hubId } = input;

      // Upsert room
      const existing = await ctx.db.query.rooms.findFirst({
        where: eq(rooms.id, room.id),
      });

      if (existing) {
        await ctx.db
          .update(rooms)
          .set({
            ...room,
            hubId,
          })
          .where(eq(rooms.id, room.id));
      } else {
        await ctx.db.insert(rooms).values({
          ...room,
          hubId,
        });
      }

      return { success: true };
    }),

  // Update a room
  update: protectedProcedure
    .input(
      z.object({
        floorId: z.number().optional(),
        id: z.string(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const { floorId, ...updateData } = updates;

      const finalUpdateData = {
        ...updateData,
        ...(floorId !== undefined && { floor: floorId }),
      };

      const [updated] = await ctx.db
        .update(rooms)
        .set(finalUpdateData)
        .where(eq(rooms.id, id))
        .returning();

      return updated;
    }),
});

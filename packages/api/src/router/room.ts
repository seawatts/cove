import { eq } from '@cove/db';
import { Rooms } from '@cove/db/schema';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const roomRouter = createTRPCRouter({
  // Create a new room
  create: protectedProcedure
    .input(
      z.object({
        color: z.string().optional(),
        description: z.string().optional(),
        floor: z.number().optional(),
        icon: z.string().optional(),
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [room] = await ctx.db
        .insert(Rooms)
        .values({
          color: input.color,
          description: input.description,
          floor: input.floor,
          icon: input.icon,
          name: input.name,
          userId: ctx.auth.userId,
        })
        .returning();

      return room;
    }),

  // Delete a room
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(Rooms).where(eq(Rooms.id, input.id));
      return { success: true };
    }),

  // Get a specific room with devices
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.Rooms.findFirst({
        where: eq(Rooms.id, input.id),
        with: {
          devices: true,
        },
      });
    }),
  // List all rooms for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.Rooms.findMany({
      orderBy: (rooms, { asc }) => [asc(rooms.name)],
      where: eq(Rooms.userId, ctx.auth.userId),
      with: {
        devices: {
          columns: {
            deviceType: true,
            id: true,
            name: true,
            online: true,
          },
        },
      },
    });
  }),

  // Update a room
  update: protectedProcedure
    .input(
      z.object({
        color: z.string().optional(),
        description: z.string().optional(),
        floor: z.number().optional(),
        icon: z.string().optional(),
        id: z.string(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const [updated] = await ctx.db
        .update(Rooms)
        .set(updateData)
        .where(eq(Rooms.id, id))
        .returning();

      return updated;
    }),
});

import { createUserSchema, eq } from '@cove/db';
import { users } from '@cove/db/schema';
import type { UserPreferences } from '@cove/db/types';
import { createId } from '@cove/id';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const userRouter = createTRPCRouter({
  all: publicProcedure.query(({ ctx }) => {
    return ctx.db.query.users.findMany({
      limit: 10,
    });
  }),
  auth: protectedProcedure.query(({ ctx }) => {
    return {
      sessionId: ctx.auth.sessionId,
      userId: ctx.auth.userId,
    };
  }),
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.query.users.findFirst({
        where: eq(users.id, input.id),
      });
    }),
  create: protectedProcedure
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .insert(users)
        .values({ ...input, id: createId({ prefix: 'user' }) })
        .returning();
      return user;
    }),
  current: protectedProcedure.query(({ ctx }) => {
    return ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.auth.userId),
    });
  }),
  delete: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const [user] = await ctx.db
      .delete(users)
      .where(eq(users.id, input))
      .returning();
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }),
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      columns: {
        preferences: true,
      },
      where: eq(users.id, ctx.auth.userId),
    });

    // Return default preferences if user not found or preferences are null
    return (user?.preferences ?? { syncTooltips: true }) as UserPreferences;
  }),
  updatePreferences: protectedProcedure
    .input(
      z.object({
        syncTooltips: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get current preferences
      const currentUser = await ctx.db.query.users.findFirst({
        columns: {
          preferences: true,
        },
        where: eq(users.id, ctx.auth.userId),
      });

      // Merge with existing preferences
      const updatedPreferences: UserPreferences = {
        ...(currentUser?.preferences as UserPreferences | null),
        ...input,
      };

      const [user] = await ctx.db
        .update(users)
        .set({ preferences: updatedPreferences })
        .where(eq(users.id, ctx.auth.userId))
        .returning({ preferences: users.preferences });

      return user?.preferences as UserPreferences;
    }),
});

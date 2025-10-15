import { eq } from '@cove/db';
import { CreateUserSchema, Users } from '@cove/db/schema';
import { createId } from '@cove/id';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const userRouter = createTRPCRouter({
  all: publicProcedure.query(({ ctx }) => {
    return ctx.db.query.Users.findMany({
      limit: 10,
    });
  }),
  auth: protectedProcedure.query(({ ctx }) => {
    return {
      orgId: ctx.auth.orgId,
      sessionId: ctx.auth.sessionId,
      userId: ctx.auth.userId,
    };
  }),
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.query.Users.findFirst({
        where: eq(Users.id, input.id),
      });
    }),
  create: protectedProcedure
    .input(CreateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .insert(Users)
        .values({ ...input, id: createId({ prefix: 'user' }) })
        .returning();
      return user;
    }),
  current: protectedProcedure.query(({ ctx }) => {
    return ctx.db.query.Users.findFirst({
      where: eq(Users.id, ctx.auth.userId),
    });
  }),
  delete: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const [user] = await ctx.db
      .delete(Users)
      .where(eq(Users.id, input))
      .returning();
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }),
});

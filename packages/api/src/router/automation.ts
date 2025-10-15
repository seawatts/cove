import { eq } from '@cove/db';
import { Automations, Scenes } from '@cove/db/schema';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const automationRouter = createTRPCRouter({
  // Create automation
  create: protectedProcedure
    .input(
      z.object({
        actions: z.array(z.record(z.string(), z.unknown())),
        conditions: z.array(z.record(z.string(), z.unknown())).default([]),
        description: z.string().optional(),
        enabled: z.boolean().default(true),
        name: z.string(),
        trigger: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [automation] = await ctx.db
        .insert(Automations)
        .values({
          ...input,
          userId: ctx.auth.userId,
        })
        .returning();

      return automation;
    }),

  // Delete automation
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(Automations).where(eq(Automations.id, input.id));
      return { success: true };
    }),

  // Get a specific automation
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.Automations.findFirst({
        where: eq(Automations.id, input.id),
      });
    }),
  // List all automations
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.Automations.findMany({
      orderBy: (automations, { desc }) => [desc(automations.createdAt)],
      where: eq(Automations.userId, ctx.auth.userId),
    });
  }),

  // Toggle automation enabled/disabled
  toggle: protectedProcedure
    .input(z.object({ enabled: z.boolean(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(Automations)
        .set({ enabled: input.enabled })
        .where(eq(Automations.id, input.id))
        .returning();

      return updated;
    }),
});

export const sceneRouter = createTRPCRouter({
  // Activate a scene
  activate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Execute scene actions
      const [updated] = await ctx.db
        .update(Scenes)
        .set({ lastActivated: new Date() })
        .where(eq(Scenes.id, input.id))
        .returning();

      return updated;
    }),

  // Create scene
  create: protectedProcedure
    .input(
      z.object({
        actions: z.array(z.record(z.string(), z.unknown())),
        description: z.string().optional(),
        icon: z.string().optional(),
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [scene] = await ctx.db
        .insert(Scenes)
        .values({
          ...input,
          userId: ctx.auth.userId,
        })
        .returning();

      return scene;
    }),

  // Delete scene
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(Scenes).where(eq(Scenes.id, input.id));
      return { success: true };
    }),
  // List all scenes
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.Scenes.findMany({
      orderBy: (scenes, { desc }) => [desc(scenes.createdAt)],
      where: eq(Scenes.userId, ctx.auth.userId),
    });
  }),
});

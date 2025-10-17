import { eq } from '@cove/db';
import { automation, scene } from '@cove/db/schema';
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
        .insert(automation)
        .values({
          ...input,
          userId: ctx.auth.userId,
        })
        .returning();

      return automations;
    }),

  // Delete automation
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(automation).where(eq(automation.id, input.id));
      return { success: true };
    }),

  // Get a specific automation
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.automation.findFirst({
        where: eq(automation.id, input.id),
      });
    }),
  // List all automations
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.automation.findMany({
      orderBy: (automations, { desc }) => [desc(automations.createdAt)],
      where: eq(automation.userId, ctx.auth.userId),
    });
  }),

  // Toggle automation enabled/disabled
  toggle: protectedProcedure
    .input(z.object({ enabled: z.boolean(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(automation)
        .set({ enabled: input.enabled })
        .where(eq(automation.id, input.id))
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
        .update(scene)
        .set({ lastActivated: new Date() })
        .where(eq(scene.id, input.id))
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
        .insert(scene)
        .values({
          ...input,
          userId: ctx.auth.userId,
        })
        .returning();

      return scenes;
    }),

  // Delete scene
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(scene).where(eq(scene.id, input.id));
      return { success: true };
    }),
  // List all scenes
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.scene.findMany({
      orderBy: (scenes, { desc }) => [desc(scenes.createdAt)],
      where: eq(scene.userId, ctx.auth.userId),
    });
  }),
});

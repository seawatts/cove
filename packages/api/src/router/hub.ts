import { Hubs } from '@cove/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const hubRouter = createTRPCRouter({
  // Delete a hub
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(Hubs).where(eq(Hubs.id, input.id));
      return { success: true };
    }),

  // Get a specific hub
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.Hubs.findFirst({
        where: eq(Hubs.id, input.id),
        with: {
          devices: true,
        },
      });
    }),
  // List all hubs for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.Hubs.findMany({
      orderBy: (hubs, { desc }) => [desc(hubs.lastSeen)],
      where: eq(Hubs.userId, ctx.auth.userId),
    });
  }),

  // Update hub configuration
  updateConfig: protectedProcedure
    .input(
      z.object({
        config: z.object({
          apiPort: z.number().optional(),
          autoUpdate: z.boolean().optional(),
          discoveryEnabled: z.boolean().optional(),
          discoveryInterval: z.number().optional(),
          enabledProtocols: z.array(z.string()).optional(),
          telemetryInterval: z.number().optional(),
          updateChannel: z.enum(['stable', 'beta', 'dev']).optional(),
          wsPort: z.number().optional(),
        }),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch existing hub to merge config
      const existingHub = await ctx.db.query.Hubs.findFirst({
        where: eq(Hubs.id, input.id),
      });

      if (!existingHub) {
        throw new Error('Hub not found');
      }

      const [updated] = await ctx.db
        .update(Hubs)
        .set({
          config: {
            ...existingHub.config,
            ...input.config,
          } as typeof existingHub.config,
        })
        .where(eq(Hubs.id, input.id))
        .returning();

      return updated;
    }),
});

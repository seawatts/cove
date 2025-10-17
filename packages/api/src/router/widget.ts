import { and } from '@cove/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const widgetRouter = createTRPCRouter({
  deletePreference: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        sensorKey: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db
        .delete(WidgetPreferences)
        .where(
          and(
            eq(WidgetPreferences.userId, ctx.auth.userId),
            eq(WidgetPreferences.deviceId, input.deviceId),
            eq(WidgetPreferences.sensorKey, input.sensorKey),
          ),
        )
        .returning();
    }),
  getPreferences: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(WidgetPreferences)
        .where(
          and(
            eq(WidgetPreferences.userId, ctx.auth.userId),
            eq(WidgetPreferences.deviceId, input.deviceId),
          ),
        );
    }),

  setPreference: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        sensorKey: z.string(),
        widgetConfig: z.record(z.string(), z.unknown()).optional(),
        widgetType: z.enum(['chart', 'value_card', 'gauge', 'table', 'radial']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if preference already exists
      const existing = await ctx.db
        .select()
        .from(WidgetPreferences)
        .where(
          and(
            eq(WidgetPreferences.userId, ctx.auth.userId),
            eq(WidgetPreferences.deviceId, input.deviceId),
            eq(WidgetPreferences.sensorKey, input.sensorKey),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        if (!existing[0]?.id) {
          throw new Error('Widget preference not found');
        }
        // Update existing preference
        return await ctx.db
          .update(WidgetPreferences)
          .set({
            updatedAt: new Date(),
            widgetConfig: input.widgetConfig || {},
            widgetType: input.widgetType,
          })
          .where(eq(WidgetPreferences.id, existing[0]?.id))
          .returning();
      }
      // Create new preference
      return await ctx.db
        .insert(WidgetPreferences)
        .values({
          deviceId: input.deviceId,
          sensorKey: input.sensorKey,
          userId: ctx.auth.userId,
          widgetConfig: input.widgetConfig || {},
          widgetType: input.widgetType,
        })
        .returning();
    }),
});

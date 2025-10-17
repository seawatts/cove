import { and, desc, eq } from '@cove/db';
import { apiKeys, apiKeyUsage, CreateApiKeySchema } from '@cove/db/schema';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const apiKeysRouter = createTRPCRouter({
  all: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.auth.orgId) throw new Error('Organization ID is required');

    const keys = await ctx.db.query.apiKeys.findMany({
      orderBy: [desc(apiKeys.updatedAt)],
      where: eq(apiKeys.orgId, ctx.auth.orgId),
    });

    return keys;
  }),

  allWithLastUsage: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.auth.orgId) throw new Error('Organization ID is required');

    // Get all API keys
    const keys = await ctx.db.query.apiKeys.findMany({
      orderBy: [desc(apiKeys.updatedAt)],
      where: eq(apiKeys.orgId, ctx.auth.orgId),
    });

    // For each API key, get the most recent usage
    const apiKeysWithLastUsage = await Promise.all(
      apiKeys.map(async (apiKey) => {
        const lastUsage = await ctx.db.query.apiKeyUsage.findFirst({
          orderBy: [desc(apiKeyUsage.createdAt)],
          where: eq(apiKeyUsage.apiKeyId, apiKey.id),
        });

        return {
          ...apiKey,
          lastUsage,
        };
      }),
    );

    return apiKeysWithLastUsage;
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.auth.orgId) throw new Error('Organization ID is required');

      const apiKey = await ctx.db.query.apiKeys.findFirst({
        where: and(eq(apiKeys.id, input.id), eq(apiKeys.orgId, ctx.auth.orgId)),
      });

      if (!apiKey) return null;

      return apiKey;
    }),

  create: protectedProcedure
    .input(CreateApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth.orgId) throw new Error('Organization ID is required');
      if (!ctx.auth.userId) throw new Error('User ID is required');

      try {
        const [apiKey] = await ctx.db
          .insert(apiKeys)
          .values({
            ...input,
            orgId: ctx.auth.orgId,
            userId: ctx.auth.userId,
          })
          .returning();

        return apiKey;
      } catch (error) {
        console.error(error);
        throw new Error('Failed to create API key');
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth.orgId) throw new Error('Organization ID is required');

      const apiKey = await ctx.db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.orgId, ctx.auth.orgId)))
        .returning();

      return apiKey;
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth.orgId) throw new Error('Organization ID is required');

      // First get the current state
      const currentApiKey = await ctx.db.query.apiKeys.findFirst({
        where: and(eq(apiKeys.id, input.id), eq(apiKeys.orgId, ctx.auth.orgId)),
      });

      if (!currentApiKey) throw new Error('API Key not found');

      const [apiKey] = await ctx.db
        .update(apiKeys)
        .set({
          isActive: !currentApiKey.isActive,
        })
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.orgId, ctx.auth.orgId)))
        .returning();

      return apiKey;
    }),

  update: protectedProcedure
    .input(
      z.object({
        expiresAt: z.date().nullable().optional(),
        id: z.string(),
        isActive: z.boolean().optional(),
        name: z.string().optional(),
        permissions: z
          .object({
            admin: z.boolean().optional(),
            delete: z.boolean().optional(),
            read: z.boolean().optional(),
            webhookIds: z.array(z.string()).optional(),
            write: z.boolean().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth.orgId) throw new Error('Organization ID is required');

      const { id, ...updateData } = input;

      const [apiKey] = await ctx.db
        .update(apiKeys)
        .set(updateData)
        .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, ctx.auth.orgId)))
        .returning();

      return apiKey;
    }),

  updateLastUsed: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.auth.orgId) throw new Error('Organization ID is required');

      const [apiKey] = await ctx.db
        .update(apiKeys)
        .set({
          lastUsedAt: new Date(),
        })
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.orgId, ctx.auth.orgId)))
        .returning();

      return apiKey;
    }),
});

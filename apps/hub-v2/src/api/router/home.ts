/**
 * Home Router
 * Home information queries
 */

import { createTRPCRouter, publicProcedure } from '../trpc';

export const homeRouter = createTRPCRouter({
  /**
   * Get default home information
   */
  get: publicProcedure.query(async ({ ctx }) => {
    const registry = ctx.daemon.getRegistry();
    if (!registry) {
      throw new Error('Registry not available');
    }

    return await registry.getOrCreateHome('Default Home');
  }),
});

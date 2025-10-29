/**
 * Health Router
 * Hub health and status queries
 */

import { createTRPCRouter, publicProcedure } from '../trpc';

export const healthRouter = createTRPCRouter({
  /**
   * Get driver health information
   */
  getDriverHealth: publicProcedure.query(async ({ ctx }) => {
    return await ctx.daemon.getDriverHealth();
  }),
  /**
   * Get hub status and component health
   */
  getStatus: publicProcedure.query(async ({ ctx }) => {
    const status = ctx.daemon.getStatus();
    const driverHealth = await ctx.daemon.getDriverHealth();

    return {
      components: status.components,
      drivers: driverHealth,
      hubId: status.hubId,
      status: status.running ? 'healthy' : 'stopped',
      workerLoops: status.workerLoops,
    };
  }),
});

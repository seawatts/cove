/**
 * Device Router
 * Device queries and mutations
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const deviceRouter = createTRPCRouter({
  /**
   * Get a single device by ID
   */
  get: publicProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const registry = ctx.daemon.getRegistry();
      if (!registry) {
        throw new Error('Registry not available');
      }

      const device = await registry.getDevice(input.deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      return device;
    }),

  /**
   * Get entities for a device
   */
  getEntities: publicProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const entities = await ctx.daemon.getEntities({
        deviceId: input.deviceId,
      });
      return entities;
    }),
  /**
   * List devices by home
   */
  list: publicProcedure
    .input(z.object({ homeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const devices = await ctx.daemon.getDevicesByHome(input.homeId);
      return devices;
    }),

  /**
   * Pair a device
   */
  pair: publicProcedure
    .input(
      z.object({
        address: z.string(),
        credentials: z.record(z.string(), z.unknown()).optional(),
        deviceId: z.string(),
        password: z.string().optional(),
        protocol: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { deviceId, protocol, address, password, credentials } = input;

      // Get driver for protocol
      const driverRegistry = ctx.daemon.getDriverRegistry();
      const driver = driverRegistry?.get(protocol);
      if (!driver) {
        throw new Error(`No driver found for protocol: ${protocol}`);
      }

      // Pair device
      await driver.pair(deviceId, {
        address,
        password,
        ...credentials,
      });

      // Store credentials if provided
      const registry = ctx.daemon.getRegistry();
      if (credentials && registry) {
        await registry.storeCredentials(
          deviceId,
          `${protocol}_credentials`,
          credentials,
        );
      }

      // Mark device as paired
      if (registry) {
        await registry.markDevicePaired(deviceId);
      }

      return {
        message: 'Device paired successfully',
        success: true,
      };
    }),
});

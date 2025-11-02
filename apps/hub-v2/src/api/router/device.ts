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
      const registry = ctx.daemon.getRegistry();
      if (!registry) {
        throw new Error('Registry not available');
      }

      const entities = await registry.getEntities({
        deviceId: input.deviceId,
      });

      // Get entity states separately
      const stateStore = ctx.daemon.getStateStore();
      if (!stateStore) {
        return entities.map((entity) => ({ ...entity, currentState: null }));
      }

      // Fetch states for all entities in parallel and transform to currentState format
      const entitiesWithState = await Promise.all(
        entities.map(async (entity) => {
          const state = await stateStore.getEntityState(entity.id);
          if (!state) {
            return { ...entity, currentState: null };
          }

          // Handle SQLite state format: state is a JSON object
          const stateObj = state.state as Record<string, unknown>;

          // For PostgreSQL compatibility, extract the main value for state field
          // SQLite sensors: {value: 682, unit: "ppm"} -> state should be 682
          // SQLite lights/switches: {state: true} -> state should be true
          // PostgreSQL: state is already a string
          let stateValue: string;
          if (typeof stateObj === 'string') {
            stateValue = stateObj;
          } else if (typeof stateObj === 'object' && stateObj !== null) {
            // For sensors, extract the value field
            if ('value' in stateObj) {
              stateValue = String(stateObj.value);
            }
            // For lights/switches, extract the state field
            else if ('state' in stateObj) {
              stateValue = String(stateObj.state);
            }
            // Fallback to stringified object
            else {
              stateValue = JSON.stringify(stateObj);
            }
          } else {
            stateValue = String(stateObj);
          }

          return {
            ...entity,
            currentState: {
              attrs: stateObj,
              state: stateValue,
              updatedAt: state.updatedAt,
            },
          };
        }),
      );

      return entitiesWithState;
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

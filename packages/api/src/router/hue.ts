/**
 * Philips Hue API Router
 * Handles bridge pairing, discovery, and light control
 */

import { DeviceCommands, Devices } from '@cove/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const hueRouter = createTRPCRouter({
  /**
   * Activate a Hue scene
   */
  activateScene: protectedProcedure
    .input(
      z.object({
        bridgeId: z.string(),
        sceneId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the bridge exists and belongs to the user
      const bridge = await ctx.db.query.Devices.findFirst({
        where: and(
          eq(Devices.id, input.bridgeId),
          eq(Devices.userId, ctx.auth.userId),
        ),
      });

      if (!bridge) {
        throw new Error('Bridge not found');
      }

      // TODO: Communicate with hub daemon to activate the scene
      // The hub daemon should:
      // 1. Get the HueAdapter for the bridge
      // 2. Call adapter's scene activation method

      return {
        sceneId: input.sceneId,
        success: true,
      };
    }),

  /**
   * Control a Hue light
   */
  controlLight: protectedProcedure
    .input(
      z.object({
        command: z.object({
          brightness: z.number().min(0).max(100).optional(),
          colorTemp: z.number().optional(),
          hue: z.number().min(0).max(65535).optional(),
          on: z.boolean().optional(),
          saturation: z.number().min(0).max(254).optional(),
        }),
        lightId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the light exists and belongs to the user
      const light = await ctx.db.query.Devices.findFirst({
        where: and(
          eq(Devices.id, input.lightId),
          eq(Devices.userId, ctx.auth.userId),
        ),
      });

      if (!light) {
        throw new Error('Light not found');
      }

      // Write command to queue for hub daemon to process
      // Hub daemon subscribes to Realtime updates on this table
      const commands = [];

      if (input.command.on !== undefined) {
        commands.push({
          capability: 'on_off',
          deviceId: input.lightId,
          status: 'pending' as const,
          value: input.command.on,
        });
      }

      if (input.command.brightness !== undefined) {
        commands.push({
          capability: 'brightness',
          deviceId: input.lightId,
          status: 'pending' as const,
          value: input.command.brightness,
        });
      }

      if (input.command.colorTemp !== undefined) {
        commands.push({
          capability: 'color_temperature',
          deviceId: input.lightId,
          status: 'pending' as const,
          value: input.command.colorTemp,
        });
      }

      if (
        input.command.hue !== undefined &&
        input.command.saturation !== undefined
      ) {
        commands.push({
          capability: 'color_rgb',
          deviceId: input.lightId,
          status: 'pending' as const,
          value: {
            hue: input.command.hue,
            saturation: input.command.saturation,
          },
        });
      }

      // Insert commands into queue
      if (commands.length > 0) {
        await ctx.db.insert(DeviceCommands).values(commands);
      }

      // Optimistically update the state in database for immediate UI feedback
      const newState = { ...light.state };

      if (input.command.on !== undefined) {
        newState.on = input.command.on;
      }

      if (input.command.brightness !== undefined) {
        newState.brightness = input.command.brightness;
      }

      if (input.command.colorTemp !== undefined) {
        newState.color_temp = input.command.colorTemp;
      }

      const [updated] = await ctx.db
        .update(Devices)
        .set({
          lastSeen: new Date(),
          state: newState,
        })
        .where(eq(Devices.id, input.lightId))
        .returning();

      return updated;
    }),
  /**
   * Discover Hue bridges on the network
   * This triggers the hub daemon to perform discovery
   */
  discoverBridges: protectedProcedure.mutation(async ({ ctx }) => {
    // TODO: Communicate with hub daemon to trigger Hue bridge discovery
    // For now, return bridges that are already in the database
    const bridges = await ctx.db.query.Devices.findMany({
      where: and(
        eq(Devices.userId, ctx.auth.userId),
        eq(Devices.protocol, 'hue'),
        eq(Devices.deviceType, 'other'), // Bridges are marked as 'other' device type
      ),
    });

    return bridges.map((bridge) => ({
      authenticated: !!bridge.config?.api_key,
      bridgeId: bridge.config?.bridgeId as string | undefined,
      id: bridge.id,
      ipAddress: bridge.ipAddress,
      name: bridge.name,
    }));
  }),

  /**
   * Get all lights for a specific Hue bridge
   */
  getLights: protectedProcedure
    .input(z.object({ bridgeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const lights = await ctx.db.query.Devices.findMany({
        where: and(
          eq(Devices.userId, ctx.auth.userId),
          eq(Devices.protocol, 'hue'),
          eq(Devices.deviceType, 'light'),
          eq(Devices.hubId, input.bridgeId),
        ),
        with: {
          room: true,
        },
      });

      return lights;
    }),

  /**
   * Check pairing status
   * Returns whether the bridge has been authenticated
   */
  getPairingStatus: protectedProcedure
    .input(z.object({ bridgeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bridge = await ctx.db.query.Devices.findFirst({
        where: and(
          eq(Devices.id, input.bridgeId),
          eq(Devices.userId, ctx.auth.userId),
        ),
      });

      if (!bridge) {
        throw new Error('Bridge not found');
      }

      return {
        authenticated: !!bridge.config?.api_key,
        bridgeId: bridge.id,
        username: bridge.config?.api_key as string | undefined,
      };
    }),

  /**
   * Get available scenes for a bridge
   */
  getScenes: protectedProcedure
    .input(z.object({ bridgeId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify the bridge exists and belongs to the user
      const bridge = await ctx.db.query.Devices.findFirst({
        where: and(
          eq(Devices.id, input.bridgeId),
          eq(Devices.userId, ctx.auth.userId),
        ),
      });

      if (!bridge) {
        throw new Error('Bridge not found');
      }

      // TODO: Get scenes from hub daemon
      // For now, return empty array
      return [];
    }),

  /**
   * Get all Hue bridges for the current user
   */
  listBridges: protectedProcedure.query(async ({ ctx }) => {
    const bridges = await ctx.db.query.Devices.findMany({
      where: and(
        eq(Devices.userId, ctx.auth.userId),
        eq(Devices.protocol, 'hue'),
        eq(Devices.deviceType, 'other'),
      ),
      with: {
        room: true,
      },
    });

    return bridges.map((bridge) => ({
      authenticated: !!bridge.config?.api_key,
      bridgeId: bridge.config?.bridgeId as string | undefined,
      id: bridge.id,
      ipAddress: bridge.ipAddress,
      name: bridge.name,
      online: bridge.online,
      room: bridge.room,
    }));
  }),

  /**
   * Initiate bridge pairing
   * This tells the hub daemon to start the authentication process
   */
  pairBridge: protectedProcedure
    .input(z.object({ bridgeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the bridge exists and belongs to the user
      const bridge = await ctx.db.query.Devices.findFirst({
        where: and(
          eq(Devices.id, input.bridgeId),
          eq(Devices.userId, ctx.auth.userId),
        ),
      });

      if (!bridge) {
        throw new Error('Bridge not found');
      }

      // TODO: Communicate with hub daemon to trigger authentication
      // The hub daemon should:
      // 1. Call HueAdapter.authenticate(bridgeId)
      // 2. Wait for button press (30 seconds)
      // 3. Return the username (API key)
      // 4. Update the device config in the database

      // For now, return a pending status
      return {
        bridgeId: input.bridgeId,
        message: 'Press the button on your Hue bridge',
        status: 'pending',
      };
    }),
});

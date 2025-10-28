/**
 * HTTP API Routes for Hub V2
 * Using Bun 1.3 routes pattern for better type safety
 */

import { debug } from '@cove/logger';
import type { HubDaemon } from '../daemon';

const log = debug('cove:hub-v2:api');

// CORS headers for web app access
const corsHeaders = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

/**
 * Create API routes for the hub daemon
 */
export function createRoutes(daemon: HubDaemon) {
  return {
    // Default route
    '/': () =>
      Response.json(
        {
          name: 'Cove Hub V2',
          status: 'running',
          version: '2.0.0',
        },
        { headers: corsHeaders },
      ),

    // Devices
    '/devices': {
      GET: async (req: Request) => {
        try {
          const url = new URL(req.url);
          const homeId = url.searchParams.get('homeId');

          if (!homeId) {
            return Response.json(
              { error: 'homeId parameter is required' },
              { headers: corsHeaders, status: 400 },
            );
          }

          const devices = await daemon.getDevicesByHome(homeId);
          return Response.json(devices, { headers: corsHeaders });
        } catch (error) {
          log('Error getting devices:', error);
          return Response.json(
            { error: 'Failed to get devices' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
    },

    // Entities
    '/entities': {
      GET: async (req: Request) => {
        try {
          const url = new URL(req.url);
          const homeId = url.searchParams.get('homeId');
          const roomId = url.searchParams.get('roomId');
          const kind = url.searchParams.get('kind');
          const deviceId = url.searchParams.get('deviceId');

          const filters: Record<string, string> = {};
          if (homeId) filters.homeId = homeId;
          if (roomId) filters.roomId = roomId;
          if (kind) filters.kind = kind;
          if (deviceId) filters.deviceId = deviceId;

          const entities = await daemon.getEntities(filters);
          return Response.json(entities, { headers: corsHeaders });
        } catch (error) {
          log('Error getting entities:', error);
          return Response.json(
            { error: 'Failed to get entities' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
    },

    // Single entity
    '/entities/:id': {
      GET: async (req: Request) => {
        try {
          const url = new URL(req.url);
          const entityId = url.pathname.split('/').pop();

          if (!entityId) {
            return Response.json(
              { error: 'Entity ID is required' },
              { headers: corsHeaders, status: 400 },
            );
          }

          const entities = await daemon.getEntities({ deviceId: entityId });
          const entity = entities[0];

          if (!entity) {
            return Response.json(
              { error: 'Entity not found' },
              { headers: corsHeaders, status: 404 },
            );
          }

          return Response.json(entity, { headers: corsHeaders });
        } catch (error) {
          log('Error getting entity:', error);
          return Response.json(
            { error: 'Failed to get entity' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
    },

    // Entity commands
    '/entities/:id/commands': {
      OPTIONS: () => new Response(null, { headers: corsHeaders }),
      POST: async (req: Request) => {
        try {
          const url = new URL(req.url);
          const entityId = url.pathname.split('/')[2];

          if (!entityId) {
            return Response.json(
              { error: 'Entity ID is required' },
              { headers: corsHeaders, status: 400 },
            );
          }

          const body = (await req.json()) as {
            capability: string;
            value: unknown;
            userId?: string;
          };

          if (!body.capability || body.value === undefined) {
            return Response.json(
              { error: 'capability and value are required' },
              { headers: corsHeaders, status: 400 },
            );
          }

          const result = await daemon.processCommand({
            capability: body.capability,
            entityId,
            userId: body.userId,
            value: body.value,
          });

          return Response.json(result, { headers: corsHeaders });
        } catch (error) {
          log('Error processing command:', error);
          return Response.json(
            { error: 'Failed to process command' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
    },

    // Health check
    '/health': {
      GET: async () => {
        const status = daemon.getStatus();
        const driverHealth = await daemon.getDriverHealth();

        return Response.json(
          {
            components: status.components,
            drivers: driverHealth,
            hubId: status.hubId,
            status: status.running ? 'healthy' : 'stopped',
            workerLoops: status.workerLoops,
          },
          { headers: corsHeaders },
        );
      },
    },

    // Home info
    '/home': {
      GET: async () => {
        try {
          const registry = daemon.getRegistry();
          if (!registry) {
            return Response.json(
              { error: 'Registry not available' },
              { headers: corsHeaders, status: 500 },
            );
          }

          const home = await registry.getOrCreateHome('Default Home');
          return Response.json(home, { headers: corsHeaders });
        } catch (error) {
          log('Error getting home:', error);
          return Response.json(
            { error: 'Failed to get home' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
    },

    // CORS preflight for all routes
    '/OPTIONS/*': () => new Response(null, { headers: corsHeaders }),

    // Device pairing
    '/pair/:deviceId': {
      OPTIONS: () => new Response(null, { headers: corsHeaders }),
      POST: async (req: Request) => {
        try {
          const url = new URL(req.url);
          const deviceId = url.pathname.split('/').pop();

          if (!deviceId) {
            return Response.json(
              { error: 'Device ID is required' },
              { headers: corsHeaders, status: 400 },
            );
          }

          const body = (await req.json()) as {
            protocol: string;
            address: string;
            password?: string;
            credentials?: Record<string, unknown>;
          };

          if (!body.protocol || !body.address) {
            return Response.json(
              { error: 'protocol and address are required' },
              { headers: corsHeaders, status: 400 },
            );
          }

          // Get driver for protocol
          const driverRegistry = daemon.getDriverRegistry();
          const driver = driverRegistry?.get(body.protocol);
          if (!driver) {
            return Response.json(
              { error: `No driver found for protocol: ${body.protocol}` },
              { headers: corsHeaders, status: 400 },
            );
          }

          // Pair device
          await driver.pair(deviceId, {
            address: body.address,
            password: body.password,
            ...body.credentials,
          });

          // Store credentials if provided
          const registry = daemon.getRegistry();
          if (body.credentials && registry) {
            await registry.storeCredentials(
              deviceId,
              `${body.protocol}_credentials`,
              body.credentials,
            );
          }

          // Mark device as paired
          if (registry) {
            await registry.markDevicePaired(deviceId);
          }

          return Response.json(
            { message: 'Device paired successfully', success: true },
            { headers: corsHeaders },
          );
        } catch (error) {
          log('Error pairing device:', error);
          return Response.json(
            { error: 'Failed to pair device' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
    },

    // Telemetry
    '/telemetry': {
      GET: async (req: Request) => {
        try {
          const url = new URL(req.url);
          const entityId = url.searchParams.get('entityId');
          const field = url.searchParams.get('field');
          const from = url.searchParams.get('from');
          const _to = url.searchParams.get('to');
          const limit = url.searchParams.get('limit');

          if (!entityId) {
            return Response.json(
              { error: 'entityId parameter is required' },
              { headers: corsHeaders, status: 400 },
            );
          }

          const options: Record<string, unknown> = {};
          if (field) options.field = field;
          if (from) options.since = new Date(from);
          if (limit) options.limit = Number.parseInt(limit, 10);

          const telemetry = await daemon.getEntityTelemetry(entityId, options);
          return Response.json(telemetry, { headers: corsHeaders });
        } catch (error) {
          log('Error getting telemetry:', error);
          return Response.json(
            { error: 'Failed to get telemetry' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
    },
  };
}

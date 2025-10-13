#!/usr/bin/env bun
/**
 * Cove Hub - Main Entry Point
 * Self-hosted home automation hub daemon
 */

import { debug, defaultLogger } from '@cove/logger';
import { ConsoleDestination } from '@cove/logger/destinations/console';
import { HubDaemon } from './daemon';
import { env } from './env';
import { getHealth, getSystemInfo, resetStartTime } from './health';

defaultLogger.enableNamespace('*');
defaultLogger.enableNamespace('cove:*');
defaultLogger.addDestination(new ConsoleDestination());
const log = debug('cove:hub');

// Initialize daemon
const daemon = new HubDaemon();

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  log(`Received ${signal} signal, shutting down gracefully...`);
  await daemon.stop();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// CORS headers for web app access
const corsHeaders = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

// Start the hub API server using Bun.serve with Bun 1.3 routing
Bun.serve({
  hostname: env.HOST,
  port: env.PORT,

  // Define routes using Bun 1.3 routing API
  routes: {
    // Default route
    '/': () =>
      Response.json(
        {
          name: 'Cove Hub',
          status: 'running',
          version: env.HUB_VERSION,
        },
        { headers: corsHeaders },
      ),

    // Get discovered devices
    '/api/devices/discovered': {
      GET: () => {
        try {
          const devices = daemon.getDiscoveredDevices();
          return Response.json(
            {
              count: devices.length,
              devices,
            },
            { headers: corsHeaders },
          );
        } catch (error) {
          log('Error getting discovered devices:', error);
          return Response.json(
            { error: 'Failed to get discovered devices' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
      OPTIONS: () => new Response(null, { headers: corsHeaders }),
    },

    // Get hub status
    '/api/hub/status': {
      GET: () => {
        const health = getHealth();
        return Response.json(
          {
            ...health,
            discoveryEnabled: env.DISCOVERY_ENABLED,
            hubId: daemon.getHubId(),
          },
          { headers: corsHeaders },
        );
      },
      OPTIONS: () => new Response(null, { headers: corsHeaders }),
    },
    // Health check endpoint
    '/health': () => Response.json(getHealth(), { headers: corsHeaders }),

    // System info endpoint
    '/info': () => Response.json(getSystemInfo(), { headers: corsHeaders }),
  },

  // WebSocket handler for real-time updates
  websocket: {
    close(_ws, code, reason) {
      log(`WebSocket connection closed: ${code} ${reason}`);
    },
    message(_ws, message) {
      log(`WebSocket message received: ${message}`);
      // TODO: Handle device commands from clients
    },
    open(_ws) {
      log('WebSocket connection opened');
      // TODO: Subscribe client to device updates
    },
  },
});

// Start the daemon
resetStartTime();
await daemon.start();

log(`Cove Hub v${env.HUB_VERSION} started on http://${env.HOST}:${env.PORT}`);
log(`Hub ID: ${env.HUB_ID || 'not set'}`);
log(`Discovery: ${env.DISCOVERY_ENABLED ? 'enabled' : 'disabled'}`);
log(`Environment: ${env.NODE_ENV}`);

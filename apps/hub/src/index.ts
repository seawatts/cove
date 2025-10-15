#!/usr/bin/env bun
/**
 * Cove Hub - Main Entry Point
 * Self-hosted home automation hub daemon
 */

import { debug, defaultLogger } from '@cove/logger';
import { ConsoleDestination } from '@cove/logger/destinations/console';
import { RollingFileDestination } from '@cove/logger/destinations/rolling-file';
import type { EventSeverity, EventType } from '@cove/types';
import { HubDaemon } from './daemon';
import { env } from './env';
import { getHealth, getSystemInfo, resetStartTime } from './health';

defaultLogger.enableNamespace('*');
defaultLogger.enableNamespace('cove:*');
defaultLogger.addDestination(new ConsoleDestination());

// Add file-based logging
defaultLogger.addDestination(
  new RollingFileDestination({
    createDirectory: true,
    filepath: './logs/hub.log',
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024, // 10MB
  }),
);

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
  hostname: env.HOST || '0.0.0.0',
  port: env.PORT || 3100,

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

    // Get hub events (activity feed)
    '/api/hub/events': {
      GET: (req) => {
        try {
          const eventCollector = daemon.getEventCollector();

          if (!eventCollector) {
            return Response.json(
              { error: 'Event collector not initialized' },
              { headers: corsHeaders, status: 503 },
            );
          }

          const url = new URL(req.url);
          const limit = Number.parseInt(
            url.searchParams.get('limit') || '50',
            10,
          );
          const severityParam = url.searchParams.get('severity');
          const eventTypeParam = url.searchParams.get('eventType');
          const sinceParam = url.searchParams.get('since');

          const events = eventCollector.getRecentEvents({
            eventType: eventTypeParam
              ? (eventTypeParam as EventType)
              : undefined,
            limit,
            severity: severityParam
              ? (severityParam as EventSeverity)
              : undefined,
            since: sinceParam ? new Date(sinceParam) : undefined,
          });

          const counts = eventCollector.getEventCountsBySeverity();

          return Response.json(
            {
              counts,
              events,
              total: events.length,
            },
            { headers: corsHeaders },
          );
        } catch (error) {
          log('Error getting hub events:', error);
          return Response.json(
            { error: 'Failed to get hub events' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
      OPTIONS: () => new Response(null, { headers: corsHeaders }),
    },

    // Get hub logs
    '/api/hub/logs': {
      GET: async (req) => {
        try {
          const url = new URL(req.url);
          const lines = Number.parseInt(
            url.searchParams.get('lines') || '100',
            10,
          );
          const download = url.searchParams.get('download') === 'true';

          const logFile = Bun.file('./logs/hub.log');

          if (!(await logFile.exists())) {
            return Response.json(
              { error: 'Log file not found' },
              { headers: corsHeaders, status: 404 },
            );
          }

          const content = await logFile.text();
          const logLines = content.split('\n').filter((line) => line.trim());

          // Get last N lines
          const recentLines = logLines.slice(-lines);

          if (download) {
            return new Response(recentLines.join('\n'), {
              headers: {
                ...corsHeaders,
                'Content-Disposition': `attachment; filename="hub-${new Date().toISOString()}.log"`,
                'Content-Type': 'text/plain',
              },
            });
          }

          return Response.json(
            {
              lines: recentLines,
              total: logLines.length,
            },
            { headers: corsHeaders },
          );
        } catch (error) {
          log('Error getting hub logs:', error);
          return Response.json(
            { error: 'Failed to get hub logs' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
      OPTIONS: () => new Response(null, { headers: corsHeaders }),
    },

    // Get hub metrics (time-series state history)
    '/api/hub/metrics': {
      GET: (req) => {
        try {
          const metricsCollector = daemon.getMetricsCollector();

          if (!metricsCollector) {
            return Response.json(
              { error: 'Metrics collector not initialized' },
              { headers: corsHeaders, status: 503 },
            );
          }

          const url = new URL(req.url);
          const limit = Number.parseInt(
            url.searchParams.get('limit') || '100',
            10,
          );
          const sinceParam = url.searchParams.get('since');

          const stateHistory = metricsCollector.getRecentStateHistory({
            limit,
            since: sinceParam ? new Date(sinceParam) : undefined,
          });

          const currentState = metricsCollector.getCurrentState();

          return Response.json(
            {
              currentState,
              stateHistory,
              total: stateHistory.length,
            },
            { headers: corsHeaders },
          );
        } catch (error) {
          log('Error getting hub metrics:', error);
          return Response.json(
            { error: 'Failed to get hub metrics' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
      OPTIONS: () => new Response(null, { headers: corsHeaders }),
    },

    // Get hub status
    '/api/hub/status': {
      GET: () => {
        const health = getHealth(daemon);
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
    '/health': () => Response.json(getHealth(daemon), { headers: corsHeaders }),

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

log(
  `Cove Hub v${env.HUB_VERSION || '0.1.0'} started on http://${env.HOST || '0.0.0.0'}:${env.PORT || 3100}`,
);
log(`Hub ID: ${env.HUB_ID || 'not set'}`);
log(`Discovery: ${env.DISCOVERY_ENABLED ? 'enabled' : 'disabled'}`);
log(`Environment: ${env.NODE_ENV || 'development'}`);

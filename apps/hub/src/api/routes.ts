/**
 * API Routes for Hub Daemon
 * Extracted from index.ts for better organization and testability
 */

import { debug } from '@cove/logger';
import type { HubEventType } from '@cove/types';
import type { HubDaemon } from '../daemon';
import { env } from '../env';
import { getHealth, getSystemInfo } from '../health';

const log = debug('cove:hub:api');

// CORS headers for web app access
const corsHeaders = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
          name: 'Cove Hub',
          status: 'running',
          version: env.HUB_VERSION,
        },
        { headers: corsHeaders },
      ),

    // Entity command endpoint
    '/api/command': {
      OPTIONS: () => new Response(null, { headers: corsHeaders }),
      POST: async (req: Request) => {
        try {
          const body = (await req.json()) as {
            entityId: string;
            capability: string;
            value: unknown;
            userId?: string;
          };
          const { entityId, capability, value, userId } = body;

          // Validate input
          if (!entityId || !capability || value === undefined) {
            return Response.json(
              { error: 'Missing required fields: entityId, capability, value' },
              { headers: corsHeaders, status: 400 },
            );
          }

          // Send command to daemon
          const startTime = Date.now();
          const success = await daemon.sendEntityCommand({
            capability,
            entityId,
            userId,
            value,
          });

          const latency = Date.now() - startTime;

          if (success) {
            // Log command event asynchronously
            daemon.logCommandEvent({
              capability,
              entityId,
              latency,
              success: true,
              userId,
              value,
            });

            return Response.json(
              { latency, success: true },
              { headers: corsHeaders },
            );
          }

          // Log failed command
          daemon.logCommandEvent({
            capability,
            entityId,
            latency,
            success: false,
            userId,
            value,
          });

          return Response.json(
            { error: 'Command failed to execute' },
            { headers: corsHeaders, status: 500 },
          );
        } catch (error) {
          log('Error processing command:', error);
          return Response.json(
            { error: 'Failed to process command' },
            { headers: corsHeaders, status: 500 },
          );
        }
      },
    },

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
      GET: (req: Request) => {
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
          const eventTypeParam = url.searchParams.get('eventType');
          const sinceParam = url.searchParams.get('since');

          const events = eventCollector.getRecentEvents({
            eventType: eventTypeParam
              ? (eventTypeParam as HubEventType)
              : undefined,
            limit,
            since: sinceParam ? new Date(sinceParam) : undefined,
          });

          const counts = eventCollector.getEventCountsByType();

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
      GET: async (req: Request) => {
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
      GET: (req: Request) => {
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

          const metrics = metricsCollector.getRecentMetrics({
            limit,
            since: sinceParam ? new Date(sinceParam) : undefined,
          });

          const currentMetrics = metricsCollector.getCurrentMetrics();

          return Response.json(
            {
              currentMetrics,
              metrics,
              total: metrics.length,
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
  };
}

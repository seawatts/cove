/**
 * Health Check Endpoint
 */

import type { HubHealth } from '@cove/types';
import { env } from './env';

let startTime = Date.now();

export function resetStartTime() {
  startTime = Date.now();
}

export function getHealth(): HubHealth {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  return {
    components: {
      database: 'ok',
      discovery: 'ok',
      supabase: 'ok',
    },

    stats: {
      devicesConnected: 0,
      devicesOnline: 0,
      messagesProcessed: 0,
      queueLag: 0,
    },
    status: 'healthy',

    timestamp: new Date(),
    uptime,
    version: env.HUB_VERSION,
  };
}

export function getSystemInfo() {
  return {
    arch: process.arch,
    hostname: process.env.HOSTNAME || 'unknown',
    memory: {
      free: Math.floor(
        (process.memoryUsage().heapTotal - process.memoryUsage().heapUsed) /
          1024 /
          1024,
      ),
      total: Math.floor(process.memoryUsage().heapTotal / 1024 / 1024),
      used: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
  };
}

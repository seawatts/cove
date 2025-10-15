/**
 * Health Check Endpoint
 */

import { networkInterfaces, hostname as osHostname } from 'node:os';
import type { DeviceEvent, HubHealth } from '@cove/types';
import type { HubDaemon } from './daemon';
import { env } from './env';

let startTime = Date.now();

export function resetStartTime() {
  startTime = Date.now();
}

export function getHealth(daemon?: HubDaemon): HubHealth {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // Check component health
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const components: HubHealth['components'] = {
    daemon: daemon?.isRunning() ? 'ok' : 'error',
    database: 'ok', // Would need actual DB check
    discovery: 'ok',
    supabase: 'ok', // Would need actual Supabase check
  };

  // If daemon not running, mark as unhealthy
  if (components.daemon === 'error') {
    status = 'unhealthy';
  }

  // Get real stats from daemon
  let devicesConnected = 0;
  let devicesOnline = 0;
  let activeAdapters = 0;
  let recentErrors = 0;

  if (daemon) {
    try {
      // Count discovered devices
      const discovered = daemon.getDiscoveredDevices();
      devicesConnected = discovered.length;

      // Count active protocol adapters
      const adapters = daemon.getAdapters();
      activeAdapters = adapters.size;

      // Count recent errors from event collector
      const eventCollector = daemon.getEventCollector();
      if (eventCollector) {
        const recentEvents = eventCollector.getRecentEvents({
          limit: 100,
          since: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        });
        recentErrors = recentEvents.filter(
          (e: DeviceEvent) =>
            e.severity === 'error' || e.severity === 'critical',
        ).length;

        // Mark as degraded if there are recent errors
        if (recentErrors > 5) {
          status = 'degraded';
          components.daemon = 'warning';
        }
      }

      // For now, assume all discovered devices are online (we'd need to check their actual status)
      devicesOnline = devicesConnected;
    } catch (_error) {
      // If we can't get stats, mark as degraded
      status = 'degraded';
      components.daemon = 'warning';
    }
  }

  return {
    components,
    stats: {
      activeAdapters,
      devicesConnected,
      devicesOnline,
      messagesProcessed: 0, // Would need to track this in command processor
      queueLag: 0, // Would need to track pending commands
      recentErrors,
    },
    status,
    timestamp: new Date(),
    uptime,
    version: env.HUB_VERSION,
  };
}

/**
 * Get the primary local IP address
 */
function getLocalIpAddress(): string {
  const nets = networkInterfaces();

  // Try to find the primary network interface (usually en0 on Mac, eth0 on Linux)
  for (const name of Object.keys(nets)) {
    const netInfo = nets[name];
    if (!netInfo) continue;

    for (const net of netInfo) {
      // Skip internal (loopback) and non-IPv4 addresses
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        return net.address;
      }
    }
  }

  // Fallback to hostname if no IP found
  return osHostname();
}

export function getSystemInfo() {
  return {
    arch: process.arch,
    hostname: osHostname(),
    ipAddress: getLocalIpAddress(),
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

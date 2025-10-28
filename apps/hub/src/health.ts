/**
 * Health Check Endpoint
 */

import { createHash } from 'node:crypto';
import { networkInterfaces, hostname as osHostname } from 'node:os';
import type { DeviceEvent, HubHealth } from '@cove/types';
import type { HubDaemon } from './daemon';

let startTime = Date.now();

export function resetStartTime() {
  startTime = Date.now();
}

export function getHealth(daemon?: HubDaemon): HubHealth {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // Check component health
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const components: HubHealth['components'] = {
    adapters: { activeCount: 0, status: 'ok' },
    database: { status: 'ok' },
    discovery: { devicesFound: 0, status: 'ok' },
  };

  // Get real stats from daemon
  let devicesConnected = 0;
  let activeAdapters = 0;
  let recentErrors = 0;

  if (daemon) {
    try {
      // Count discovered devices
      const discovered = daemon.getDiscoveredDevices();
      devicesConnected = discovered.length;
      components.discovery.devicesFound = devicesConnected;

      // Count active protocol adapters
      const adapters = daemon.getAdapters();
      activeAdapters = adapters.size;
      components.adapters.activeCount = activeAdapters;

      // Count recent errors from event collector
      const eventCollector = daemon.getEventCollector();
      if (eventCollector) {
        const recentEvents = eventCollector.getRecentEvents({
          limit: 100,
          since: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        });
        recentErrors = recentEvents.filter(
          (e: DeviceEvent) =>
            e.eventType.includes('error') || e.eventType.includes('failed'),
        ).length;

        // Mark as degraded if there are recent errors
        if (recentErrors > 5) {
          status = 'degraded';
          components.database.status = 'warning';
        }
      }

      // Check if daemon is running
      if (!daemon.isRunning()) {
        status = 'unhealthy';
        components.database.status = 'error';
      }
    } catch (_error) {
      // If we can't get stats, mark as degraded
      status = 'degraded';
      components.database.status = 'warning';
    }
  }

  return {
    components,
    status,
    uptime,
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

/**
 * Get the primary MAC address from network interfaces
 */
export function getMacAddress(): string | null {
  const nets = networkInterfaces();

  // Try to find the primary network interface (usually en0 on Mac, eth0 on Linux)
  for (const name of Object.keys(nets)) {
    const netInfo = nets[name];
    if (!netInfo) continue;

    for (const net of netInfo) {
      // Skip internal (loopback) and non-IPv4 addresses
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal && net.mac) {
        return net.mac;
      }
    }
  }

  return null;
}

/**
 * Generate a reproducible hardware-based unique ID
 * Uses MAC address + hostname + platform for uniqueness
 */
export function getHardwareId(): string {
  const macAddress = getMacAddress();
  const hostname = osHostname();
  const platform = process.platform;
  const arch = process.arch;

  // Create a deterministic hash from hardware characteristics
  const hardwareString = `${macAddress || 'no-mac'}-${hostname}-${platform}-${arch}`;
  const hash = createHash('sha256').update(hardwareString).digest('hex');

  // Return first 12 characters for a shorter ID
  return hash.substring(0, 12);
}

export function getSystemInfo() {
  return {
    arch: process.arch,
    hardwareId: getHardwareId(),
    hostname: osHostname(),
    ipAddress: getLocalIpAddress(),
    macAddress: getMacAddress(),
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

/**
 * Hue Bridge Discovery
 *
 * Supports two discovery methods:
 * 1. mDNS (Multicast DNS) - local network discovery
 * 2. HTTPS endpoint - Philips discovery service
 */

import { debug } from '@cove/logger';
import type { HueBridgeDiscovery } from './types';

const log = debug('cove:protocols:hue:discovery');

/**
 * Discover Hue bridges using Philips HTTPS endpoint
 */
export async function discoverBridgesHTTPS(): Promise<HueBridgeDiscovery[]> {
  log('Discovering bridges via HTTPS endpoint');

  try {
    const response = await fetch('https://discovery.meethue.com/', {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Discovery failed: ${response.status}`);
    }

    const bridges = (await response.json()) as HueBridgeDiscovery[];
    log(`Found ${bridges.length} bridge(s) via HTTPS`);

    return bridges;
  } catch (error) {
    log('HTTPS discovery failed:', error);
    return [];
  }
}

/**
 * Discover Hue bridges using mDNS
 *
 * This requires the @cove/discovery package to be running.
 * The mDNS service type is: _hue._tcp
 *
 * Note: This is typically handled by the discovery manager in the hub.
 */
export function getMDNSServiceType(): string {
  return '_hue._tcp';
}

/**
 * Validate bridge discovery result
 */
export function isValidBridge(bridge: HueBridgeDiscovery): boolean {
  return Boolean(
    bridge.id &&
      bridge.internalipaddress &&
      bridge.internalipaddress.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/),
  );
}

/**
 * Get bridge base URL
 */
export function getBridgeURL(
  bridge: HueBridgeDiscovery,
  useHttps = true,
): string {
  const protocol = useHttps ? 'https' : 'http';
  const port = bridge.port || (useHttps ? 443 : 80);
  const portSuffix = port === (useHttps ? 443 : 80) ? '' : `:${port}`;

  return `${protocol}://${bridge.internalipaddress}${portSuffix}`;
}

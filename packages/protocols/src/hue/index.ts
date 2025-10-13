/**
 * Philips Hue Protocol
 *
 * REST API client for Philips Hue Bridge
 *
 * @example
 * ```typescript
 * import { HueClient, discoverBridgesHTTPS } from '@cove/protocols/hue';
 *
 * // Discover bridges
 * const bridges = await discoverBridgesHTTPS();
 *
 * // Create client
 * const client = new HueClient({
 *   host: bridges[0].internalipaddress,
 *   useHttps: true,
 * });
 *
 * // Authenticate (press button first!)
 * const username = await client.authenticate();
 *
 * // Connect and control
 * await client.connect();
 * await client.toggleLight('1', true);
 * await client.setBrightness('1', 200);
 * ```
 */

export { HueClient } from './client';
export * from './discovery';
export type * from './types';

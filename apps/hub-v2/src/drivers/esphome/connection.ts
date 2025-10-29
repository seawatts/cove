/**
 * ESPHome Driver Connection Management
 * Handles device connections and disconnections
 */

import { debug } from '@cove/logger';
import { EspHomeClient } from 'esphome-client';
import { setupEventHandlers } from './event-handlers';
import { getDriverState } from './state';
import type {
  ESPHomeClient as ESPHomeClientType,
  ESPHomeConnection,
} from './types';

const log = debug('cove:driver:esphome');

/**
 * Connect to an ESPHome device
 * Default export - primary connection function
 */
export default async function connect(
  deviceId: string,
  address: string,
): Promise<void> {
  const state = getDriverState();

  // Check if already connected
  if (state.connections.has(deviceId)) {
    const existing = state.connections.get(deviceId);
    if (existing?.connected) {
      log(`Device ${deviceId} already connected`);
      return;
    }
  }

  log(`Connecting to ESPHome device ${deviceId} at ${address}`);

  // Create new client using esphome-client
  const client = new EspHomeClient({
    host: address,
    port: 6053,
  }) as unknown as ESPHomeClientType;

  // Create connection state
  const connection: ESPHomeConnection = {
    address,
    client,
    connected: false,
    deviceId,
    deviceInfo: null,
    entities: new Map(),
    subscriptions: new Map(),
  };

  // Set up event handlers before connecting
  setupEventHandlers(connection);

  // Store connection before calling connect
  state.connections.set(deviceId, connection);

  // Connect to device - esphome-client handles everything automatically
  if (client.connect) {
    await client.connect();
  }

  log(`Connection initiated for ${deviceId}`);
}

/**
 * Disconnect from an ESPHome device
 */
export async function disconnect(deviceId: string): Promise<void> {
  const state = getDriverState();
  const connection = state.connections.get(deviceId);
  if (!connection) {
    log(`No connection found for device ${deviceId}`);
    return;
  }

  log(`Disconnecting from ${deviceId}`);

  // Clean up subscriptions
  for (const [, unsubscribe] of connection.subscriptions) {
    unsubscribe();
  }
  connection.subscriptions.clear();

  // Disconnect client
  if (connection.client.disconnect) {
    connection.client.disconnect();
  }
  connection.connected = false;

  state.connections.delete(deviceId);
  log(`Disconnected from ${deviceId}`);
}

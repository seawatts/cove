/**
 * ESPHome Driver Connection Management
 * Handles device connections and disconnections
 */

import { debug } from '@cove/logger';
import { EspHomeClient } from 'esphome-client';
import { setupEventHandlers } from './event-handlers';
import { getDriverState } from './state';
import type { ESPHomeConnection } from './types';

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

  // Create new client
  const client = new EspHomeClient({
    clientId: 'cove-hub-v2',
    host: address,
    port: 6053,
  });

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

  // Set up event handlers
  setupEventHandlers(connection);

  // Connect to device
  client.connect();

  // Wait for connection to be established
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Connection timeout for ${deviceId}`));
    }, 5000);

    client.once('connect', () => {
      clearTimeout(timeout);
      connection.connected = true;
      state.connections.set(deviceId, connection);
      resolve();
    });

    // Note: error/close events may not be typed correctly in esphome-client types
    // Use a generic approach that works with the EventEmitter interface
    const cleanup = () => {
      clearTimeout(timeout);
    };

    // Set a timeout that will reject if connection doesn't establish
    setTimeout(() => {
      cleanup();
      reject(new Error(`Connection closed for ${deviceId}`));
    }, 10000);
  });

  state.connections.set(deviceId, connection);
  log(`Successfully connected to ${deviceId}`);
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
  connection.client.disconnect();
  connection.connected = false;

  state.connections.delete(deviceId);
  log(`Disconnected from ${deviceId}`);
}

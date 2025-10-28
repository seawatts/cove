/**
 * ESPHome Driver Lifecycle Management
 * Handles driver initialization and shutdown
 */

import { debug } from '@cove/logger';
import { getDriverState, initializeBonjour } from './state';

const log = debug('cove:driver:esphome');

/**
 * Initialize the ESPHome driver
 * Default export - primary lifecycle function
 */
export default async function initialize(): Promise<void> {
  const state = getDriverState();

  if (state.initialized) {
    return;
  }

  log('Initializing ESPHome driver');

  // Initialize bonjour reference
  initializeBonjour();

  state.initialized = true;
}

/**
 * Shutdown the ESPHome driver
 * Clean up all connections and resources
 */
export async function shutdown(): Promise<void> {
  log('Shutting down ESPHome driver');

  const state = getDriverState();

  // Disconnect all active connections
  for (const [deviceId] of state.connections) {
    try {
      // Import disconnect dynamically to avoid circular dependency
      const { disconnect } = await import('./connection');
      await disconnect(deviceId);
    } catch (error) {
      log(`Error disconnecting device ${deviceId}:`, error);
    }
  }

  state.connections.clear();
  state.initialized = false;

  log('ESPHome driver shutdown complete');
}

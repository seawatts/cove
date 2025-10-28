/**
 * ESPHome Driver State Management
 * Creates and manages the driver-specific state
 */

import { debug } from '@cove/logger';
import { getDiscoveryService } from '../../core/services/discovery-service';
import type { BonjourInstance, ESPHomeConnection } from './types';

const log = debug('cove:driver:esphome');

export interface DriverState {
  connections: Map<string, ESPHomeConnection>;
  initialized: boolean;
  bonjour: BonjourInstance | null;
}

let driverState: DriverState | null = null;

/**
 * Create or get the driver state instance
 * This ensures all function files import the same state
 */
export function createDriverState(): DriverState {
  if (!driverState) {
    log('Creating ESPHome driver state');
    driverState = {
      bonjour: null,
      connections: new Map(),
      initialized: false,
    };
  }
  return driverState;
}

/**
 * Get the current driver state
 * Will create state if it doesn't exist
 */
export function getDriverState(): DriverState {
  if (!driverState) {
    return createDriverState();
  }
  return driverState;
}

/**
 * Initialize the bonjour reference in driver state
 */
export function initializeBonjour(): void {
  const state = getDriverState();
  if (!state.bonjour) {
    state.bonjour = getDiscoveryService();
  }
}

/**
 * Reset the driver state (used for testing)
 */
export function resetDriverState(): void {
  driverState = null;
}

/**
 * ESPHome Driver Subscription Management
 * Handles entity state subscriptions and state retrieval
 */

import { debug } from '@cove/logger';
import { extractDeviceId } from './helpers';
import { getDriverState } from './state';
import type { ESPHomeConnectionWithCallbacks } from './types';

const log = debug('cove:driver:esphome');

/**
 * Subscribe to entity state changes
 * Default export - primary subscription function
 */
export default function subscribeToEntity(
  entityId: string,
  callback: (state: unknown) => void,
): () => void {
  const state = getDriverState();

  // Extract deviceId from entityId
  const deviceId = extractDeviceId(entityId);
  if (!deviceId) {
    log(`Invalid entity ID: ${entityId}`);
    return () => {}; // Return no-op unsubscribe function
  }

  const connection = state.connections.get(deviceId);

  if (!connection || !connection.connected) {
    log(`No active connection for device ${deviceId}`);
    return () => {}; // Return no-op unsubscribe function
  }

  const entity = connection.entities.get(entityId);
  if (!entity) {
    log(`Entity ${entityId} not found`);
    return () => {};
  }

  // Store callback in extended connection
  const conn = connection as ESPHomeConnectionWithCallbacks;
  if (!conn.entityCallbacks) {
    conn.entityCallbacks = new Map();
  }
  conn.entityCallbacks.set(entityId, callback);

  // Create unsubscribe function
  const unsubscribe = () => {
    const extendedConn = connection as ESPHomeConnectionWithCallbacks;
    if (extendedConn.entityCallbacks) {
      extendedConn.entityCallbacks.delete(entityId);
    }
    connection.subscriptions.delete(entityId);
  };

  // Store unsubscribe function
  connection.subscriptions.set(entityId, unsubscribe);

  log(`Subscribed to entity ${entityId}`);
  return unsubscribe;
}

/**
 * Unsubscribe from entity state changes
 */
export function unsubscribeFromEntity(entityId: string): void {
  const state = getDriverState();
  const deviceId = extractDeviceId(entityId);
  if (!deviceId) {
    return;
  }
  const connection = state.connections.get(deviceId);

  if (!connection) {
    return;
  }

  const unsubscribe = connection.subscriptions.get(entityId);
  if (unsubscribe) {
    unsubscribe();
  }
}

/**
 * Subscribe to entity state changes (alias for subscribeToEntity)
 */
export async function subscribe(
  entityId: string,
  callback: (state: unknown) => void,
): Promise<() => void> {
  return subscribeToEntity(entityId, callback);
}

/**
 * Get current state of an entity
 */
export async function getState(entityId: string): Promise<unknown> {
  // TODO: Implement state retrieval
  // This would query the current state of an entity
  const state = getDriverState();
  const deviceId = extractDeviceId(entityId);
  if (!deviceId) {
    return null;
  }

  const connection = state.connections.get(deviceId);

  if (!connection || !connection.connected) {
    return null;
  }

  // For now, return null as entity states are handled via subscriptions
  return null;
}

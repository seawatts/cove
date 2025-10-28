/**
 * ESPHome Driver Event Handlers
 * Handles ESPHome client events and entity state updates
 */

import type { EventEmitter } from 'node:events';
import { debug } from '@cove/logger';
import { populateEntities, populateEntitiesFromMap } from './entities';
import { extractStateFromEntityData, findEntityByKey } from './helpers';
import type {
  ESPHomeConnection,
  ESPHomeConnectionWithCallbacks,
} from './types';

const log = debug('cove:driver:esphome');

/**
 * Set up event handlers for an ESPHome connection
 */
export function setupEventHandlers(connection: ESPHomeConnection): void {
  const { client, deviceId } = connection;

  client.on('connect', (data) => {
    log(`Connected to ${deviceId} (encrypted: ${data.encrypted})`);
    connection.connected = true;

    // Populate entities from client after connection
    setTimeout(() => {
      populateEntities(connection);
    }, 1000);
  });

  client.on('disconnect', () => {
    log(`Disconnected from ${deviceId}`);
    connection.connected = false;
  });

  // Listen for entities discovery event - cast to any to bypass type checking
  (
    client as EventEmitter & {
      on(event: string, handler: (...args: unknown[]) => void): void;
    }
  ).on(
    'entitiesComplete',
    (
      entities: Map<
        number,
        {
          config?: { name?: string; objectId?: string; entityClass?: string };
        }
      >,
    ) => {
      log(
        `Received entities complete event for ${deviceId}, count: ${entities.size}`,
      );
      populateEntitiesFromMap(connection, entities);
    },
  );

  // Listen for individual entity state updates - cast to any to bypass type checking
  (
    client as EventEmitter & {
      on(event: string, handler: (...args: unknown[]) => void): void;
    }
  ).on(
    'entityState',
    ({
      entity,
      state,
    }: {
      entity: {
        config?: { key?: number; name?: string; entityClass?: string };
      };
      state: Record<string, unknown>;
    }) => {
      log(
        `Entity state update for ${deviceId}: ${entity.config?.name || 'unknown'} = ${JSON.stringify(state)}`,
      );
      handleEntityStateUpdate(connection, entity, state);
    },
  );
}

/**
 * Handle entity state updates
 */
function handleEntityStateUpdate(
  connection: ESPHomeConnection,
  entity: { config?: { key?: number; name?: string; entityClass?: string } },
  state: Record<string, unknown>,
): void {
  try {
    const config = entity.config || {};
    const key = config.key;

    if (!key) {
      log('No key found in entity config');
      return;
    }

    // Find entity by key
    const espEntity = findEntityByKey(connection, key);

    if (!espEntity || !espEntity.entityId) {
      log(`No matching entity found for key ${key} (entity: ${config.name})`);
      return;
    }

    // Extract state data based on entity type
    const entityType = config.entityClass || 'unknown';
    const stateData = extractStateFromEntityData(entityType, state);

    log(
      `Received state update for ${espEntity.entityId}: ${JSON.stringify(stateData)}`,
    );

    // Call the callback if one is registered
    const conn = connection as ESPHomeConnectionWithCallbacks;
    if (conn.entityCallbacks) {
      const callback = conn.entityCallbacks.get(espEntity.entityId);
      if (callback) {
        callback(stateData);
      }
    }
  } catch (error) {
    log('Error handling entity state update:', error);
  }
}

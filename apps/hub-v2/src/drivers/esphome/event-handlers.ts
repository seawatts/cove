/**
 * ESPHome Driver Event Handlers
 * Handles ESPHome client events and entity state updates
 */

import { debug } from '@cove/logger';
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

  // Note: esphome-client uses 'connect' not 'connected'

  client.on('disconnected', () => {
    log(`Disconnected from ${deviceId}`);
    connection.connected = false;
  });

  // Listen for entities discovery (esphome-client uses 'entities' event with array)
  client.on(
    'entities',
    (
      entityList: Array<{
        key: number;
        name: string;
        objectId: string;
        type: string;
      }>,
    ) => {
      log(
        `Entities discovered for ${deviceId} - processing ${entityList.length} entities`,
      );
      // Process entities from the event data
      populateEntitiesFromClient(connection, entityList);
    },
  );

  // Listen for device info
  client.on('deviceInfo', (info: unknown) => {
    log(`Device info for ${deviceId}:`, info);
    connection.deviceInfo = info as ESPHomeConnection['deviceInfo'];
  });

  // Listen for connect event from esphome-client
  client.on('connect', (data: { encrypted?: boolean }) => {
    log(`Connected to ${deviceId} (encrypted: ${data.encrypted || false})`);
    connection.connected = true;
  });

  // Listen for entity state updates - the esphome-client emits both 'sensor' and 'telemetry' events
  client.on(
    'sensor',
    (data: {
      key: number;
      entity: string;
      state?: unknown;
      type: string;
      unitOfMeasurement?: string;
    }) => {
      // Find the entity by key
      for (const [entityId, entity] of connection.entities) {
        if (entity.key === data.key) {
          // Check if we have callbacks registered for this entity
          const connWithCallbacks =
            connection as ESPHomeConnectionWithCallbacks;
          if (connWithCallbacks.entityCallbacks) {
            const callback = connWithCallbacks.entityCallbacks.get(entityId);
            if (callback && data.state !== undefined) {
              // For sensors, include unit when available so downstream can persist it
              const payload = {
                unit: data.unitOfMeasurement,
                value: data.state,
              } as Record<string, unknown>;
              log(`State update for entity ${entityId}:`, payload);
              callback(payload);
            }
          }
          break;
        }
      }
    },
  );

  // Also listen for telemetry events (used for some sensor types)
  client.on(
    'telemetry',
    (data: {
      key: number;
      entity: string;
      state?: unknown;
      type: string;
      unitOfMeasurement?: string;
    }) => {
      // Find the entity by key
      for (const [entityId, entity] of connection.entities) {
        if (entity.key === data.key) {
          // Check if we have callbacks registered for this entity
          const connWithCallbacks =
            connection as ESPHomeConnectionWithCallbacks;
          if (connWithCallbacks.entityCallbacks) {
            const callback = connWithCallbacks.entityCallbacks.get(entityId);
            if (callback && data.state !== undefined) {
              // Include unit when available so downstream can persist it
              const payload = {
                unit: data.unitOfMeasurement,
                value: data.state,
              } as Record<string, unknown>;
              log(`Telemetry update for entity ${entityId}:`, payload);
              callback(payload);
            }
          }
          break;
        }
      }
    },
  );
}

/**
 * Populate entities from esphome-client
 */
function populateEntitiesFromClient(
  connection: ESPHomeConnection,
  entityList: Array<{
    key: number;
    name: string;
    objectId: string;
    type: string;
  }>,
): void {
  try {
    log(
      `Populating entities from list for ${connection.deviceId}, count: ${entityList.length}`,
    );

    for (const entity of entityList) {
      const entityId = `${connection.deviceId}:${entity.objectId}`;

      connection.entities.set(entityId, {
        entityId,
        key: entity.key,
        name: entity.name,
        objectId: entity.objectId,
        type: entity.type,
      });

      log(
        `Registered entity: ${entityId} (key: ${entity.key}, name: ${entity.name}, type: ${entity.type})`,
      );
    }

    log(
      `Populated ${connection.entities.size} entities for ${connection.deviceId}`,
    );
  } catch (error) {
    log('Error populating entities from list:', error);
  }
}

/**
 * ESPHome Driver Event Handlers
 * Handles ESPHome client events and entity state updates
 */

import { debug, info, warn } from '@cove/logger';
import type {
  ESPHomeConnection,
  ESPHomeConnectionWithCallbacks,
} from './types';

const logDebug = debug('cove:driver:esphome');
const logInfo = info('cove:driver:esphome');
const logWarn = warn('cove:driver:esphome');

/**
 * Set up event handlers for an ESPHome connection
 */
export function setupEventHandlers(connection: ESPHomeConnection): void {
  const { client, deviceId } = connection;

  // Note: esphome-client uses 'connect' not 'connected'

  client.on('disconnected', () => {
    logInfo(`Disconnected from ${deviceId}`);
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
      logDebug(
        `Entities discovered for ${deviceId} - processing ${entityList.length} entities`,
      );
      // Process entities from the event data
      populateEntitiesFromClient(connection, entityList);
    },
  );

  // Listen for device info
  client.on('deviceInfo', (info: unknown) => {
    logDebug(`Device info for ${deviceId}:`, info);
    connection.deviceInfo = info as ESPHomeConnection['deviceInfo'];
  });

  // Listen for connect event from esphome-client
  client.on('connect', (data: { encrypted?: boolean }) => {
    logInfo(`Connected to ${deviceId} (encrypted: ${data.encrypted || false})`);
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
      // Find the entity by key first, then try objectId if key doesn't match
      // Sometimes the 'key' in the event data is actually an objectId (large number)
      let foundEntityId: string | null = null;
      for (const [entityId, entity] of connection.entities) {
        if (entity.key === data.key) {
          foundEntityId = entityId;
          break;
        }
        // Also try matching by objectId if key doesn't match
        // The data.key might actually be an objectId in string/number format
        if (
          entity.objectId === String(data.key) ||
          entity.objectId === data.key.toString()
        ) {
          foundEntityId = entityId;
          break;
        }
      }

      if (!foundEntityId) {
        // Log warn when entity not found - this can happen when ESPHome sends events for entities we haven't subscribed to
        logWarn(
          `No entity found for sensor event (key: ${data.key}, entity: ${data.entity}, type: ${data.type})`,
        );
        return;
      }

      // Check if we have callbacks registered for this entity
      const connWithCallbacks = connection as ESPHomeConnectionWithCallbacks;
      if (connWithCallbacks.entityCallbacks) {
        const callback = connWithCallbacks.entityCallbacks.get(foundEntityId);
        if (callback && data.state !== undefined) {
          // For sensors, include unit when available so downstream can persist it
          const payload = {
            unit: data.unitOfMeasurement,
            value: data.state,
          } as Record<string, unknown>;
          logDebug(`State update for entity ${foundEntityId}:`, payload);
          callback(payload);
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
      // Find the entity by key first, then try objectId if key doesn't match
      // Sometimes the 'key' in the event data is actually an objectId (large number)
      let foundEntityId: string | null = null;
      for (const [entityId, entity] of connection.entities) {
        if (entity.key === data.key) {
          foundEntityId = entityId;
          break;
        }
        // Also try matching by objectId if key doesn't match
        // The data.key might actually be an objectId in string/number format
        if (
          entity.objectId === String(data.key) ||
          entity.objectId === data.key.toString()
        ) {
          foundEntityId = entityId;
          break;
        }
      }

      if (!foundEntityId) {
        // Log warn when entity not found - this can happen when ESPHome sends events for entities we haven't subscribed to
        logWarn(
          `No entity found for telemetry event (key: ${data.key}, entity: ${data.entity}, type: ${data.type})`,
        );
        return;
      }

      // Check if we have callbacks registered for this entity
      const connWithCallbacks = connection as ESPHomeConnectionWithCallbacks;
      if (connWithCallbacks.entityCallbacks) {
        const callback = connWithCallbacks.entityCallbacks.get(foundEntityId);
        if (callback && data.state !== undefined) {
          // Include unit when available so downstream can persist it
          const payload = {
            unit: data.unitOfMeasurement,
            value: data.state,
          } as Record<string, unknown>;
          logDebug(`Telemetry update for entity ${foundEntityId}:`, payload);
          callback(payload);
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
    logDebug(
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

      logDebug(
        `Registered entity: ${entityId} (key: ${entity.key}, name: ${entity.name}, type: ${entity.type})`,
      );
    }

    logInfo(
      `Populated ${connection.entities.size} entities for ${connection.deviceId}`,
    );
  } catch (err) {
    logWarn('Error populating entities from list:', err);
  }
}

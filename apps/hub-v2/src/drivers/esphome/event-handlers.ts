/**
 * ESPHome Driver Event Handlers
 * Handles ESPHome client events and entity state updates
 */

import { debug } from '@cove/logger';
import type { ESPHomeConnection } from './types';

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

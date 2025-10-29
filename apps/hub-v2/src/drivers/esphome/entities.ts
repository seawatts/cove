/**
 * ESPHome Driver Entity Management
 * Handles device info and entity enumeration
 */

import { debug } from '@cove/logger';
import type { DeviceDescriptor, EntityDescriptor } from '../../core/driver-kit';
import { createCapability, mapEntityTypeToKind } from './helpers';
import { getDriverState } from './state';
import type { ESPHomeConnection } from './types';

const log = debug('cove:driver:esphome');

/**
 * Get entities for a device
 * Default export - primary entities function
 */
export default async function getEntities(
  deviceId: string,
): Promise<EntityDescriptor[]> {
  const state = getDriverState();
  const connection = state.connections.get(deviceId);
  if (!connection || !connection.connected) {
    log(`No active connection for device ${deviceId}`);
    return [];
  }

  // ESPHome entities are discovered via the 'entities' event
  // For now, return entities that we've already stored
  const entityDescriptors: EntityDescriptor[] = [];

  for (const [entityId, espEntity] of connection.entities.entries()) {
    // Map ESPHome entity type to driver-kit entity kind
    const kind = mapEntityTypeToKind(espEntity.type);
    const capability = createCapability(espEntity.type);

    entityDescriptors.push({
      capability,
      deviceId,
      id: entityId,
      kind,
      metadata: {
        key: espEntity.key,
        objectId: espEntity.objectId,
        originalType: espEntity.type,
      },
      name: espEntity.name,
    });
  }

  return entityDescriptors;
}

/**
 * Get device info
 */
export async function getDeviceInfo(
  deviceId: string,
): Promise<DeviceDescriptor | null> {
  const state = getDriverState();
  const connection = state.connections.get(deviceId);
  if (!connection || !connection.connected) {
    log(`No active connection for device ${deviceId}`);
    return null;
  }

  const deviceInfo = connection.deviceInfo;
  if (!deviceInfo) {
    log(`Device info not yet available for ${deviceId}`);
    return null;
  }

  const deviceName =
    deviceInfo.name || deviceInfo.friendlyName || 'Unknown ESPHome Device';
  const deviceVendor = deviceInfo.manufacturer || 'ESPHome';

  return {
    address: connection.address,
    capabilities: [], // Will be populated from entities
    id: deviceId,
    metadata: {
      compilationTime: deviceInfo.compilationTime,
      macAddress: deviceInfo.macAddress,
      projectName: deviceInfo.projectName,
      projectVersion: deviceInfo.projectVersion,
      webserverPort: deviceInfo.webserverPort || 80,
    },
    model: deviceInfo.model || 'Unknown Model',
    name: deviceName,
    protocol: 'esphome',
    vendor: deviceVendor,
    version: deviceInfo.esphomeVersion,
  };
}

/**
 * Populate entities from ESPHome client
 */
export function populateEntities(connection: ESPHomeConnection): void {
  const { client, deviceId } = connection;

  try {
    // ESPHome client provides entity information through various methods
    // We'll try to access the entities from the client's internal state
    const anyClient = client as Record<string, unknown>;

    // Helper function to safely access entity properties
    const getEntityProps = (entity: unknown) => {
      const e = entity as { key?: number; name?: string; objectId?: string };
      return {
        key: e.key ?? 0,
        name: e.name ?? 'Unknown',
        objectId: e.objectId ?? '',
      };
    };

    // Get entity arrays from client
    const binarySensors = (anyClient.binarySensors || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;
    const switches = (anyClient.switches || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;
    const lights = (anyClient.lights || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;
    const buttons = (anyClient.buttons || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;
    const numbers = (anyClient.numbers || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;
    const selects = (anyClient.selects || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;
    const fans = (anyClient.fans || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;
    const covers = (anyClient.covers || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;
    const climates = (anyClient.climates || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;
    const locks = (anyClient.locks || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;
    const textSensors = (anyClient.textSensors || []) as Array<{
      key?: number;
      name?: string;
      objectId?: string;
    }>;

    // Process each entity type - using compact loops
    for (const sensor of anyClient.sensors || []) {
      const props = getEntityProps(sensor);
      const entityId = `${deviceId}:${props.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: props.key,
        name: props.name,
        objectId: props.objectId,
        type: 'sensor',
      });
      log(`Registered sensor entity: ${entityId} (${props.name})`);
    }

    for (const entity of binarySensors) {
      const props = getEntityProps(entity);
      const entityId = `${deviceId}:${props.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: props.key,
        name: props.name,
        objectId: props.objectId,
        type: 'binary_sensor',
      });
      log(`Registered binary_sensor entity: ${entityId} (${props.name})`);
    }

    for (const switchEntity of switches) {
      const entityId = `${deviceId}:${switchEntity.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: switchEntity.key ?? 0,
        name: switchEntity.name ?? 'Unknown',
        objectId: switchEntity.objectId ?? '',
        type: 'switch',
      });
      log(`Registered switch entity: ${entityId} (${switchEntity.name})`);
    }

    for (const light of lights) {
      const entityId = `${deviceId}:${light.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: light.key ?? 0,
        name: light.name ?? 'Unknown',
        objectId: light.objectId ?? '',
        type: 'light',
      });
      log(`Registered light entity: ${entityId} (${light.name})`);
    }

    for (const button of buttons) {
      const entityId = `${deviceId}:${button.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: button.key ?? 0,
        name: button.name ?? 'Unknown',
        objectId: button.objectId ?? '',
        type: 'button',
      });
      log(`Registered button entity: ${entityId} (${button.name})`);
    }

    for (const number of numbers) {
      const entityId = `${deviceId}:${number.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: number.key ?? 0,
        name: number.name ?? 'Unknown',
        objectId: number.objectId ?? '',
        type: 'number',
      });
      log(`Registered number entity: ${entityId} (${number.name})`);
    }

    for (const select of selects) {
      const entityId = `${deviceId}:${select.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: select.key ?? 0,
        name: select.name ?? 'Unknown',
        objectId: select.objectId ?? '',
        type: 'select',
      });
      log(`Registered select entity: ${entityId} (${select.name})`);
    }

    for (const fan of fans) {
      const entityId = `${deviceId}:${fan.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: fan.key ?? 0,
        name: fan.name ?? 'Unknown',
        objectId: fan.objectId ?? '',
        type: 'fan',
      });
      log(`Registered fan entity: ${entityId} (${fan.name})`);
    }

    for (const cover of covers) {
      const entityId = `${deviceId}:${cover.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: cover.key ?? 0,
        name: cover.name ?? 'Unknown',
        objectId: cover.objectId ?? '',
        type: 'cover',
      });
      log(`Registered cover entity: ${entityId} (${cover.name})`);
    }

    for (const climate of climates) {
      const entityId = `${deviceId}:${climate.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: climate.key ?? 0,
        name: climate.name ?? 'Unknown',
        objectId: climate.objectId ?? '',
        type: 'climate',
      });
      log(`Registered climate entity: ${entityId} (${climate.name})`);
    }

    for (const lock of locks) {
      const entityId = `${deviceId}:${lock.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: lock.key ?? 0,
        name: lock.name ?? 'Unknown',
        objectId: lock.objectId ?? '',
        type: 'lock',
      });
      log(`Registered lock entity: ${entityId} (${lock.name})`);
    }

    for (const textSensor of textSensors) {
      const entityId = `${deviceId}:${textSensor.objectId}`;
      connection.entities.set(entityId, {
        entityId,
        key: textSensor.key ?? 0,
        name: textSensor.name ?? 'Unknown',
        objectId: textSensor.objectId ?? '',
        type: 'text_sensor',
      });
      log(`Registered text_sensor entity: ${entityId} (${textSensor.name})`);
    }

    log(`Populated ${connection.entities.size} entities for ${deviceId}`);
  } catch (error) {
    log(`Error populating entities for ${deviceId}:`, error);
  }
}

/**
 * Populate entities from entities complete event
 */
export function populateEntitiesFromMap(
  connection: ESPHomeConnection,
  entities: Map<
    number,
    { config?: { name?: string; objectId?: string; entityClass?: string } }
  >,
): void {
  const { deviceId } = connection;

  try {
    log(
      `Populating entities from Map for ${deviceId}, count: ${entities.size}`,
    );

    for (const [key, entity] of entities.entries()) {
      const config = entity.config || {};
      const entityId = `${deviceId}:${config.objectId || key}`;

      connection.entities.set(entityId, {
        entityId,
        key,
        name: config.name || 'Unknown',
        objectId: config.objectId || String(key),
        type: config.entityClass || 'unknown',
      });

      log(
        `Registered entity: ${entityId} (key: ${key}, name: ${config.name}, type: ${config.entityClass})`,
      );
    }

    log(`Populated ${connection.entities.size} entities for ${deviceId}`);
  } catch (error) {
    log(`Error populating entities for ${deviceId}:`, error);
  }
}

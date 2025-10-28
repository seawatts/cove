/**
 * ESPHome Driver Helper Functions
 * Utility functions used throughout the driver
 */

import { debug } from '@cove/logger';
import type { Service } from 'bonjour-service';
import { CapabilityTypes, EntityKinds } from '../../core/driver-kit';
import type {
  CapabilityDescriptor,
  ESPHomeConnection,
  ESPHomeEntity,
} from './types';

const log = debug('cove:driver:esphome');

/**
 * Check if a discovered service is an ESPHome device
 */
export function isESPHomeDevice(service: Service): boolean {
  // Check PST records for ESPHome indicators
  if (service.txt) {
    const txt = service.txt as Record<string, string>;
    // ESPHome devices often have specific fields in TXT records
    if (txt.project_name || txt.project_version || txt.esphome_version) {
      log(`  TXT ESPHome indicators found: ${JSON.stringify(txt)}`);
      return true;
    }
  }

  // Check if this is an ESPHome device by examining the service type
  if (service.type.includes('esphomelib')) {
    log('  Service type includes esphomelib');
    return true;
  }

  // Check HTTP services for ESPHome characteristics
  if (service.type.includes('http')) {
    log('  Checking HTTP service for ESPHome characteristics');

    // Check TXT records for ESPHome indicators
    if (service.txt) {
      const txt = service.txt as Record<string, string>;
      log(`  TXT records: ${JSON.stringify(txt)}`);
      if (txt.path === '/' || txt.path === '/esphome') {
        log('  Path matches ESPHome pattern');
        return true;
      }
    }

    // Check hostname and service name patterns
    const hostname = service.host?.toLowerCase() || '';
    const serviceName = service.name?.toLowerCase() || '';
    const combinedName = `${hostname} ${serviceName}`;

    if (
      combinedName.includes('apollo') ||
      combinedName.includes('esphome') ||
      combinedName.includes('esp32') ||
      combinedName.includes('esp8266')
    ) {
      log(
        `  Name matches ESPHome pattern - host: ${service.host}, name: ${service.name}`,
      );
      return true;
    }

    // Check if port is typical ESPHome API port (6053)
    // Note: We don't check for port 80 responding here to avoid false positives
    if (service.port === 6053) {
      log('  Port matches ESPHome API port (6053)');
      return true;
    }
  }

  return false;
}

/**
 * Map ESPHome entity type to driver-kit entity kind
 */
export function mapEntityTypeToKind(type: string): EntityKinds {
  const typeMap: Record<string, EntityKinds> = {
    alarm_control_panel: EntityKinds.ALARM,
    binary_sensor: EntityKinds.BINARY_SENSOR,
    button: EntityKinds.BUTTON,
    camera: EntityKinds.IMAGE,
    climate: EntityKinds.CLIMATE,
    cover: EntityKinds.COVER,
    date: EntityKinds.DATE,
    datetime: EntityKinds.TIME,
    fan: EntityKinds.FAN,
    light: EntityKinds.LIGHT,
    lock: EntityKinds.LOCK,
    media_player: EntityKinds.MEDIA_PLAYER,
    number: EntityKinds.NUMBER,
    select: EntityKinds.SELECT,
    sensor: EntityKinds.SENSOR,
    siren: EntityKinds.BUTTON, // Approximate
    switch: EntityKinds.SWITCH,
    text: EntityKinds.TEXT,
    text_sensor: EntityKinds.TEXT,
    time: EntityKinds.TIME,
    update: EntityKinds.UPDATE,
    valve: EntityKinds.SWITCH, // Approximate
  };

  return typeMap[type] || EntityKinds.SENSOR;
}

/**
 * Create a capability descriptor based on entity type
 */
export function createCapability(type: string): CapabilityDescriptor {
  switch (type) {
    case 'light':
      return {
        attributes: {
          supportsBrightness: true,
          supportsColor: true,
          supportsColorTemp: true,
        },
        type: CapabilityTypes.ON_OFF,
      };
    case 'switch':
      return {
        type: CapabilityTypes.ON_OFF,
      };
    case 'binary_sensor':
      return {
        type: CapabilityTypes.CONTACT,
      };
    case 'sensor':
      return {
        type: CapabilityTypes.NUMERIC,
      };
    case 'cover':
      return {
        type: CapabilityTypes.POSITION,
      };
    case 'fan':
      return {
        type: CapabilityTypes.SPEED,
      };
    case 'climate':
      return {
        type: CapabilityTypes.TEMPERATURE,
      };
    case 'lock':
      return {
        type: CapabilityTypes.LOCK,
      };
    default:
      return {
        type: CapabilityTypes.NUMERIC,
      };
  }
}

/**
 * Extract state data from ESPHome entity based on type
 */
export function extractStateFromEntityData(
  entityType: string,
  data: Record<string, unknown>,
): unknown {
  switch (entityType) {
    case 'sensor':
      return {
        unit: data.unitOfMeasurement,
        value: data.state,
      };
    case 'binary_sensor':
      return {
        state: data.state,
      };
    case 'switch':
    case 'light': {
      const rgb = data.rgb as
        | { r?: number; g?: number; b?: number }
        | undefined;
      return {
        brightness: data.brightness,
        color: rgb ? { b: rgb.b, g: rgb.g, r: rgb.r } : undefined,
        state: data.state === 'on',
      };
    }
    case 'number':
      return {
        max: data.maxValue,
        min: data.minValue,
        step: data.step,
        value: data.state,
      };
    case 'select':
      return {
        options: data.options,
        value: data.state,
      };
    case 'fan':
      return {
        oscillating: data.oscillating,
        speed: data.speed,
        state: data.state,
      };
    case 'cover':
      return {
        position: data.position,
        state: data.state,
      };
    case 'climate':
      return {
        currentHumidity: data.currentHumidity,
        currentTemperature: data.currentTemperature,
        mode: data.mode,
        targetHumidity: data.targetHumidity,
        targetTemperature: data.targetTemperature,
      };
    case 'lock':
      return {
        state: data.state,
      };
    case 'text_sensor':
      return {
        value: data.state,
      };
    default:
      return data;
  }
}

/**
 * Find entity in connection by key
 */
export function findEntityByKey(
  connection: ESPHomeConnection,
  key: number,
): ESPHomeEntity | undefined {
  return Array.from(connection.entities.values()).find((e) => e.key === key);
}

/**
 * Extract device ID from entity ID
 */
export function extractDeviceId(entityId: string): string | null {
  const deviceId = entityId.split(':')[0];
  return deviceId || null;
}

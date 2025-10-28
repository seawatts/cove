/**
 * Test data factories for Hub V2 integration tests
 * Creates mock devices, entities, and related test data
 */

import type {
  CapabilityDescriptor,
  DeviceDescriptor,
  EntityDescriptor,
} from '../core/driver-kit';
import { CapabilityTypes, EntityKinds } from '../core/driver-kit';

/**
 * Create a mock device descriptor
 */
export function createMockDeviceDescriptor(
  protocol = 'esphome',
  overrides: Partial<DeviceDescriptor> = {},
): DeviceDescriptor {
  return {
    address: '192.168.1.100',
    capabilities: ['on_off', 'brightness'],
    id: `test-${protocol}-device-${Math.random().toString(36).substring(7)}`,
    meta: {
      fingerprint: `aa:bb:cc:dd:ee:ff:${Math.random().toString(16).substring(2)}`,
    },
    model: 'Test Device',
    name: `Test ${protocol} Device`,
    protocol,
    vendor: 'Test Vendor',
    version: '1.0.0',
    ...overrides,
  };
}

/**
 * Create a mock entity descriptor
 */
export function createMockEntityDescriptor(
  deviceId: string,
  type: EntityKinds = EntityKinds.LIGHT,
  overrides: Partial<EntityDescriptor> = {},
): EntityDescriptor {
  const capability: CapabilityDescriptor =
    type === EntityKinds.LIGHT
      ? {
          attributes: {
            max: 255,
            min: 0,
          },
          state: false,
          type: CapabilityTypes.ON_OFF,
        }
      : {
          attributes: {
            unit: '°C',
          },
          state: 22.5,
          type: CapabilityTypes.TEMPERATURE,
        };

  return {
    capability,
    deviceId,
    id: `${deviceId}_${type}_${Math.random().toString(36).substring(7)}`,
    kind: type,
    metadata: {
      key: `${type}_1`,
    },
    name: `Test ${type}`,
    ...overrides,
  };
}

/**
 * Create mock ESPHome device credentials
 */
export function createMockCredentials(
  protocol = 'esphome',
): Record<string, unknown> {
  if (protocol === 'esphome') {
    return {
      address: '192.168.1.100',
      password: 'test-password-123',
    };
  }

  return {
    address: '192.168.1.100',
  };
}

/**
 * Create a mock telemetry event
 */
export function createMockTelemetryEvent(
  entityId: string,
  field: string,
  value: number | string | boolean,
): {
  entityId: string;
  field: string;
  value: number | string | boolean;
  unit?: string;
} {
  return {
    entityId,
    field,
    unit: field === 'temperature' ? '°C' : undefined,
    value,
  };
}

/**
 * Create a mock command request
 */
export function createMockCommandRequest(
  entityId: string,
  capability: string,
  value: unknown,
): {
  capability: string;
  entityId: string;
  value: unknown;
} {
  return {
    capability,
    entityId,
    value,
  };
}

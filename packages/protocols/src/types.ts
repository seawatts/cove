/**
 * Shared types for protocol implementations
 * Updated for Home Assistant-inspired entity-first architecture
 */

import type { EntityKind, StateUpdate } from '@cove/types';

export interface ProtocolClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface ProtocolAdapter extends ProtocolClient {
  readonly name: string;
  readonly protocol: string;

  /**
   * Initialize the adapter
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the adapter
   */
  shutdown(): Promise<void>;

  /**
   * Connect to a specific device
   */
  connectDevice?(device: {
    id: string;
    name: string;
    [key: string]: unknown;
  }): Promise<void>;
}

// Entity discovery interface for protocol adapters
export interface ProtocolEntity {
  key: string; // Unique key (e.g., 'sensor.temp_living_room')
  kind: EntityKind; // Entity type
  name: string; // Display name
  deviceClass?: string;
  capabilities: import('@cove/db').EntityCapability[]; // Capabilities and metadata
  deviceId: string; // Parent device
}

// Entity state subscription interface
export interface EntityStateSubscription {
  entityId: string;
  callback: (state: StateUpdate) => void;
}

// Protocol adapter interface with entity support
export interface EntityAwareProtocolAdapter extends ProtocolAdapter {
  /**
   * Discover entities for a device
   */
  discoverEntities(deviceId: string): Promise<ProtocolEntity[]>;

  /**
   * Subscribe to entity state changes
   */
  subscribeEntityState(
    entityId: string,
    callback: (state: StateUpdate) => void,
  ): void;

  /**
   * Unsubscribe from entity state changes
   */
  unsubscribeEntityState(entityId: string): void;

  /**
   * Send command to entity
   */
  sendEntityCommand(
    entityId: string,
    capability: string,
    value: unknown,
  ): Promise<boolean>;
}

// Device connection interface (updated for HA architecture)
export interface DeviceConnection {
  deviceId: string;
  adapter: EntityAwareProtocolAdapter;
  entities: Map<string, ProtocolEntity>; // entityId -> ProtocolEntity
  subscriptions: Map<string, EntityStateSubscription>; // entityId -> subscription
}

// Protocol-specific entity mapping
export interface EntityMapping {
  protocolType: string;
  deviceType: string;
  entityKind: EntityKind;
  keyPattern: string; // Pattern for generating entity keys
  deviceClass?: string;
  capabilities: import('@cove/db').EntityCapability[];
}

// Common entity mappings for different protocols
export const ESPHOME_ENTITY_MAPPINGS: EntityMapping[] = [
  {
    capabilities: [{ type: 'numeric', unit: '°C' }],
    deviceClass: 'temperature',
    deviceType: 'sensor',
    entityKind: 'sensor' as EntityKind,
    keyPattern: 'sensor.{device_name}_{entity_name}',
    protocolType: 'esphome',
  },
  {
    capabilities: [{ type: 'on_off' }],
    deviceClass: 'motion',
    deviceType: 'binary_sensor',
    entityKind: 'binary_sensor' as EntityKind,
    keyPattern: 'binary_sensor.{device_name}_{entity_name}',
    protocolType: 'esphome',
  },
  {
    capabilities: [
      { type: 'on_off' },
      { type: 'brightness' },
      { type: 'color_temp' },
    ],
    deviceType: 'light',
    entityKind: 'light' as EntityKind,
    keyPattern: 'light.{device_name}_{entity_name}',
    protocolType: 'esphome',
  },
  {
    capabilities: [{ type: 'on_off' }],
    deviceType: 'switch',
    entityKind: 'switch' as EntityKind,
    keyPattern: 'switch.{device_name}_{entity_name}',
    protocolType: 'esphome',
  },
];

export const HUE_ENTITY_MAPPINGS: EntityMapping[] = [
  {
    capabilities: [
      { type: 'on_off' },
      { type: 'brightness' },
      { type: 'color_temp' },
      { type: 'rgb' },
    ],
    deviceType: 'light',
    entityKind: 'light' as EntityKind,
    keyPattern: 'light.hue_{room_name}_{light_name}',
    protocolType: 'hue',
  },
  {
    capabilities: [{ type: 'on_off' }],
    deviceClass: 'motion',
    deviceType: 'motion_sensor',
    entityKind: 'binary_sensor' as EntityKind,
    keyPattern: 'binary_sensor.hue_{room_name}_motion',
    protocolType: 'hue',
  },
  {
    capabilities: [{ type: 'numeric', unit: '°C' }],
    deviceClass: 'temperature',
    deviceType: 'temperature_sensor',
    entityKind: 'sensor' as EntityKind,
    keyPattern: 'sensor.hue_{room_name}_temperature',
    protocolType: 'hue',
  },
];

// Helper function to generate entity key
export function generateEntityKey(
  mapping: EntityMapping,
  deviceName: string,
  entityName: string,
  roomName?: string,
): string {
  return mapping.keyPattern
    .replace('{device_name}', deviceName.toLowerCase().replace(/\s+/g, '_'))
    .replace('{entity_name}', entityName.toLowerCase().replace(/\s+/g, '_'))
    .replace(
      '{room_name}',
      roomName?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
    );
}

// Helper function to find entity mapping
export function findEntityMapping(
  protocolType: string,
  deviceType: string,
  mappings: EntityMapping[],
): EntityMapping | undefined {
  return mappings.find(
    (mapping) =>
      mapping.protocolType === protocolType &&
      mapping.deviceType === deviceType,
  );
}

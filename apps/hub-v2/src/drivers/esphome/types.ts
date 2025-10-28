/**
 * ESPHome Driver Types
 * Type definitions for the ESPHome driver
 */

import type { Bonjour as BonjourInstance, Service } from 'bonjour-service';
import type { DeviceInfo, EspHomeClient } from 'esphome-client';
import type {
  CapabilityDescriptor,
  DeviceDescriptor,
  DriverCommand,
  DriverResult,
  EntityDescriptor,
} from '../../core/driver-kit';

export interface ExtendedESPHomeConnection {
  entityCallbacks?: Map<string, (state: unknown) => void>;
}

export interface ESPHomeConnection {
  client: EspHomeClient;
  deviceId: string;
  address: string;
  deviceInfo: DeviceInfo | null;
  entities: Map<string, ESPHomeEntity>;
  subscriptions: Map<string, () => void>;
  connected: boolean;
}

export type ESPHomeConnectionWithCallbacks = ESPHomeConnection &
  ExtendedESPHomeConnection;

export interface ESPHomeEntity {
  key: number;
  name: string;
  objectId: string;
  type: string;
  entityId: string;
}

export type {
  BonjourInstance,
  CapabilityDescriptor,
  DeviceDescriptor,
  DeviceInfo,
  DriverCommand,
  DriverResult,
  EntityDescriptor,
  Service,
};

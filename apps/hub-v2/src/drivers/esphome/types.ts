/**
 * ESPHome Driver Types
 * Type definitions for the ESPHome driver
 */

import type { EventEmitter } from 'node:events';
import type { Bonjour as BonjourInstance, Service } from 'bonjour-service';

// Type for the Client from esphome-client
export type ESPHomeClient = EventEmitter & {
  entities?: Map<unknown, unknown>;
} & {
  disconnect?: () => void;
  connect?: () => Promise<void>;
};

// Re-export DeviceInfoResponse type from protobuf
export type DeviceInfoResponse = {
  usesPassword: boolean;
  name: string;
  macAddress: string;
  esphomeVersion: string;
  compilationTime: string;
  model: string;
  hasDeepSleep?: boolean;
  projectName: string;
  projectVersion: string;
  webserverPort: number;
  manufacturer?: string;
  friendlyName?: string;
  suggestedArea?: string;
  bluetoothMacAddress?: string;
  [key: string]: unknown;
};

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
  client: ESPHomeClient;
  deviceId: string;
  address: string;
  deviceInfo: DeviceInfoResponse | null;
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
  config?: {
    name?: string;
    objectId?: string;
    [key: string]: unknown;
  };
}

export type {
  BonjourInstance,
  CapabilityDescriptor,
  DeviceDescriptor,
  DriverCommand,
  DriverResult,
  EntityDescriptor,
  Service,
};

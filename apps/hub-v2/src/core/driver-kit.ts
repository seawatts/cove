/**
 * Driver Kit - Core interfaces and utilities for Hub V2 drivers
 * Provides standardized interfaces for device drivers and entity management
 */

export interface DeviceDescriptor {
  id: string;
  name: string;
  protocol: string;
  vendor: string;
  model: string;
  version?: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
  address?: string;
  meta?: Record<string, unknown>;
}

export interface EntityDescriptor {
  id: string;
  name: string;
  kind: EntityKinds;
  capability: CapabilityDescriptor;
  deviceId: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityDescriptor {
  type: CapabilityTypes;
  attributes?: Record<string, unknown>;
  state?: unknown;
}

export enum EntityKinds {
  LIGHT = 'light',
  SWITCH = 'switch',
  SENSOR = 'sensor',
  COVER = 'cover',
  CLIMATE = 'climate',
  FAN = 'fan',
  LOCK = 'lock',
  ALARM = 'alarm',
  BUTTON = 'button',
  NUMBER = 'number',
  SELECT = 'select',
  TEXT = 'text',
  TIME = 'time',
  DATE = 'date',
  IMAGE = 'image',
  MEDIA_PLAYER = 'media_player',
  NOTIFY = 'notify',
  UPDATE = 'update',
  VACUUM = 'vacuum',
  WATER_HEATER = 'water_heater',
  WEATHER = 'weather',
  BINARY_SENSOR = 'binary_sensor',
}

export enum CapabilityTypes {
  ON_OFF = 'on_off',
  BRIGHTNESS = 'brightness',
  COLOR_TEMP = 'color_temp',
  COLOR_RGB = 'color_rgb',
  COLOR_HS = 'color_hs',
  POSITION = 'position',
  TILT = 'tilt',
  TEMPERATURE = 'temperature',
  HUMIDITY = 'humidity',
  PRESSURE = 'pressure',
  ILLUMINANCE = 'illuminance',
  MOTION = 'motion',
  OCCUPANCY = 'occupancy',
  CONTACT = 'contact',
  SMOKE = 'smoke',
  CO = 'co',
  WATER_LEAK = 'water_leak',
  DOOR = 'door',
  WINDOW = 'window',
  GARAGE_DOOR = 'garage_door',
  LOCK = 'lock',
  ALARM = 'alarm',
  BUTTON = 'button',
  NUMBER = 'number',
  SELECT = 'select',
  TEXT = 'text',
  TIME = 'time',
  DATE = 'date',
  IMAGE = 'image',
  MEDIA_PLAYER = 'media_player',
  NOTIFY = 'notify',
  UPDATE = 'update',
  VACUUM = 'vacuum',
  WATER_HEATER = 'water_heater',
  WEATHER = 'weather',
  RGB = 'rgb',
  NUMERIC = 'numeric',
  SPEED = 'speed',
}

export interface DriverCommand {
  entityId: string;
  capability: string;
  value: unknown;
  metadata?: Record<string, unknown>;
}

export interface DriverResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

export interface Driver {
  /**
   * Initialize the driver
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the driver
   */
  shutdown(): Promise<void>;

  /**
   * Discover devices
   */
  discover(): AsyncGenerator<DeviceDescriptor, void, unknown>;

  /**
   * Connect to a device
   */
  connect(deviceId: string, address: string): Promise<void>;

  /**
   * Disconnect from a device
   */
  disconnect(deviceId: string): Promise<void>;

  /**
   * Get device info
   */
  getDeviceInfo(deviceId: string): Promise<DeviceDescriptor | null>;

  /**
   * Get entities for a device
   */
  getEntities(deviceId: string): Promise<EntityDescriptor[]>;

  /**
   * Subscribe to entity state changes
   */
  subscribeToEntity(
    entityId: string,
    callback: (state: unknown) => void,
  ): () => void;

  /**
   * Unsubscribe from entity state changes
   */
  unsubscribeFromEntity(entityId: string): void;

  /**
   * Invoke a command on an entity
   */
  invoke(entityId: string, command: DriverCommand): Promise<DriverResult>;

  /**
   * Pair with a device
   */
  pair(deviceId: string, credentials?: Record<string, unknown>): Promise<void>;

  /**
   * Subscribe to entity state changes (alias for subscribeToEntity)
   */
  subscribe(entityId: string, callback: (state: unknown) => void): () => void;

  /**
   * Get current state of an entity
   */
  getState(entityId: string): Promise<unknown>;
}

export interface DriverRegistry {
  /**
   * Register a driver
   */
  register(protocol: string, driver: Driver): void;

  /**
   * Register and initialize a driver
   */
  registerAndInitialize?(protocol: string, driver: Driver): Promise<void>;

  /**
   * Shutdown all drivers
   */
  shutdownAll?(): Promise<void>;

  /**
   * Unregister a driver
   */
  unregister(protocol: string): void;

  /**
   * Get a driver by protocol
   */
  get(protocol: string): Driver | undefined;

  /**
   * Get all registered protocols
   */
  getProtocols(): string[];

  /**
   * Check if a protocol is registered
   */
  has(protocol: string): boolean;

  /**
   * Get all registered drivers
   */
  getAll(): Driver[];

  /**
   * Get health status of all drivers
   */
  health(): Record<string, boolean>;
}

/**
 * Create a capability descriptor
 */
export function createCapability(
  type: CapabilityTypes,
  attributes?: Record<string, unknown>,
  state?: unknown,
): CapabilityDescriptor {
  return {
    attributes,
    state,
    type,
  };
}

/**
 * Create a device descriptor
 */
export function createDeviceDescriptor(
  id: string,
  name: string,
  protocol: string,
  vendor: string,
  model: string,
  capabilities: string[],
  version?: string,
  metadata?: Record<string, unknown>,
): DeviceDescriptor {
  return {
    capabilities,
    id,
    metadata,
    model,
    name,
    protocol,
    vendor,
    version,
  };
}

/**
 * Create an entity descriptor
 */
export function createEntityDescriptor(
  id: string,
  name: string,
  kind: EntityKinds,
  capability: CapabilityDescriptor,
  deviceId: string,
  metadata?: Record<string, unknown>,
): EntityDescriptor {
  return {
    capability,
    deviceId,
    id,
    kind,
    metadata,
    name,
  };
}

/**
 * Simple driver registry implementation
 */
export class SimpleDriverRegistry implements DriverRegistry {
  private drivers = new Map<string, Driver>();
  private initialized = false;

  register(protocol: string, driver: Driver): void {
    this.drivers.set(protocol, driver);
  }

  async registerAndInitialize(protocol: string, driver: Driver): Promise<void> {
    await driver.initialize();
    this.drivers.set(protocol, driver);
  }

  async initializeAll(): Promise<void> {
    if (this.initialized) return;

    const initPromises = Array.from(this.drivers.values()).map((driver) =>
      driver.initialize().catch((error) => {
        console.error('Failed to initialize driver:', error);
      }),
    );

    await Promise.all(initPromises);
    this.initialized = true;
  }

  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.drivers.values()).map((driver) =>
      driver.shutdown().catch((error) => {
        console.error('Failed to shutdown driver:', error);
      }),
    );

    await Promise.all(shutdownPromises);
    this.initialized = false;
  }

  unregister(protocol: string): void {
    this.drivers.delete(protocol);
  }

  get(protocol: string): Driver | undefined {
    return this.drivers.get(protocol);
  }

  getProtocols(): string[] {
    return Array.from(this.drivers.keys());
  }

  has(protocol: string): boolean {
    return this.drivers.has(protocol);
  }

  getAll(): Driver[] {
    return Array.from(this.drivers.values());
  }

  health(): Record<string, boolean> {
    const health: Record<string, boolean> = {};
    for (const [protocol] of this.drivers) {
      // Simple health check - assume all drivers are healthy
      health[protocol] = true;
    }
    return health;
  }
}

/**
 * Default driver registry instance
 */
export const DriverRegistry = new SimpleDriverRegistry();

/**
 * ESPHome Protocol Adapter
 * Updated for Home Assistant++ entity-first architecture
 * Wraps @cove/protocols/esphome/native for hub daemon integration
 */

import type { Device } from '@cove/db';
import { debug } from '@cove/logger';
import type {
  EntityAwareProtocolAdapter,
  ProtocolEntity,
} from '@cove/protocols';
// Remove unused import
import {
  type ESPHomeEntity,
  ESPHomeNativeClient,
} from '@cove/protocols/esphome';
import type { ProtocolType, StateUpdate } from '@cove/types';
import { EntityKind } from '@cove/types';
import type { HubDatabase } from '../db';
import type { StateManager } from '../state-manager';

const log = debug('cove:hub:adapter:esphome');

interface ESPHomeEntityConfig {
  key: number;
  name: string;
  objectId: string;
  uniqueId: string;
  type: string;
  deviceClass?: string;
  unitOfMeasurement?: string;
  accuracyDecimals?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  supportsBrightness?: boolean;
  supportedColorModes?: number[];
  minMireds?: number;
  maxMireds?: number;
}

interface ESPHomeDeviceConnection {
  client: ESPHomeNativeClient;
  deviceId: string;
  device: {
    id: string;
    name: string;
    ipAddress?: string;
    manufacturer?: string;
    model?: string;
    metadata?: Record<string, unknown>;
  };
  ipAddress: string;
  connected: boolean;
  entities: Map<string, ProtocolEntity>; // entityId -> ProtocolEntity
  entityKeyMap: Map<number, string>; // ESPHome numeric key -> our entityId
  subscriptions: Map<string, (state: StateUpdate) => void>; // entityId -> callback
}

export class ESPHomeAdapter implements EntityAwareProtocolAdapter {
  readonly name = 'ESPHome Adapter';
  readonly protocol: ProtocolType = 'esphome' as ProtocolType;

  private connections: Map<string, ESPHomeDeviceConnection> = new Map();
  private initialized = false;
  private stateManager: StateManager | null = null;
  private db: HubDatabase | null = null;
  private testMode = false;
  private testEntities: Map<string, ProtocolEntity> = new Map();

  constructor(
    stateManager?: StateManager | null,
    db?: HubDatabase | null,
    testMode = false,
  ) {
    this.stateManager = stateManager || null;
    this.db = db || null;
    this.testMode = testMode;

    if (testMode) {
      this.initializeTestEntities();
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      log('Already initialized');
      return;
    }

    if (this.testMode) {
      log('Initializing ESPHome adapter in test mode');
    } else {
      log('Initializing ESPHome adapter');
    }

    this.initialized = true;
    log('ESPHome adapter initialized');
  }

  /**
   * Initialize test entities for simulation
   */
  private initializeTestEntities(): void {
    // Create mock entities for testing
    const testEntity1: ProtocolEntity = {
      capabilities: [{ max: 85, min: -40, type: 'numeric', unit: '°C' }],
      deviceId: 'test-device',
      key: 'test-entity-1',
      kind: EntityKind.Sensor,
      name: 'Test Temperature Sensor',
    };

    const testEntity2: ProtocolEntity = {
      capabilities: [
        { type: 'on_off' },
        { max: 255, min: 0, type: 'brightness' },
      ],
      deviceId: 'test-device',
      key: 'test-entity-2',
      kind: EntityKind.Light,
      name: 'Test Light',
    };

    this.testEntities.set('test-entity-1', testEntity1);
    this.testEntities.set('test-entity-2', testEntity2);
  }

  /**
   * Connect to device in test mode (simulated)
   */
  private async connectDeviceTestMode(device: {
    id: string;
    name: string;
    ipAddress?: string;
    manufacturer?: string;
    model?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const deviceId = device.id;

    // Create simulated connection
    const connection: ESPHomeDeviceConnection = {
      client: null as any, // Not used in test mode
      connected: true,
      device,
      deviceId,
      entities: new Map(),
      entityKeyMap: new Map(),
      ipAddress: device.ipAddress || '192.168.1.100',
      subscriptions: new Map(),
    };

    this.connections.set(deviceId, connection);
    log(`Connected to test device: ${device.name}`);
  }

  async shutdown(): Promise<void> {
    log('Shutting down ESPHome adapter');

    // Disconnect all devices
    for (const [deviceId, connection] of this.connections.entries()) {
      try {
        await connection.client.disconnect();
        log(`Disconnected from device: ${deviceId}`);
      } catch (error) {
        log(`Error disconnecting from device ${deviceId}:`, error);
      }
    }

    this.connections.clear();
    this.initialized = false;
    log('ESPHome adapter shut down');
  }

  async startDiscovery(): Promise<void> {
    log('ESPHome discovery is handled by @cove/discovery mDNS service');
    // Discovery is handled by the main discovery service
    // This adapter just receives connect() calls for discovered devices
  }

  async stopDiscovery(): Promise<void> {
    // No-op, discovery is handled externally
  }

  async connect(): Promise<void> {
    // No-op for global connection
  }

  async disconnect(): Promise<void> {
    await this.shutdown();
  }

  isConnected(): boolean {
    return this.initialized && this.connections.size > 0;
  }

  /**
   * Connect to an ESPHome device (custom method for hub integration)
   */
  async connectDevice(device: {
    id: string;
    name: string;
    ipAddress?: string;
    manufacturer?: string;
    model?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!device.id) {
      throw new Error('Device must have an ID to connect');
    }

    const deviceId = device.id;

    if (this.testMode) {
      log(`Connecting to ESPHome device in test mode: ${device.name}`);
      return this.connectDeviceTestMode(device);
    }

    if (!device.ipAddress) {
      throw new Error('ESPHome device requires IP address');
    }

    log(`Connecting to ESPHome device: ${device.name} at ${device.ipAddress}`);

    // Check if already connected
    if (this.connections.has(deviceId)) {
      log(`Already connected to device: ${deviceId}`);
      return;
    }

    // Create client
    const client = new ESPHomeNativeClient({
      clientInfo: 'Cove Hub',
      host: device.ipAddress,
      password: (device.metadata?.api_password as string) || '',
      port: 6053,
    });

    // Store connection info
    const connection: ESPHomeDeviceConnection = {
      client,
      connected: false,
      device,
      deviceId,
      entities: new Map(),
      entityKeyMap: new Map(),
      ipAddress: device.ipAddress,
      subscriptions: new Map(),
    };

    this.connections.set(deviceId, connection);

    try {
      // Set up event handlers before connecting
      this.setupEventHandlers(connection);

      // Connect to device
      await client.connect();
      connection.connected = true;
      log(`Successfully connected to device: ${deviceId}`);
    } catch (error) {
      log(`Failed to connect to device ${deviceId}:`, error);
      this.connections.delete(deviceId);
      throw error;
    }
  }

  /**
   * Setup event handlers for ESPHome client
   */
  private setupEventHandlers(connection: ESPHomeDeviceConnection): void {
    const { client, device } = connection;

    // Handle device info
    client.on('deviceInfo', (info) => {
      log(`Device info for ${device.name}:`, info);

      // Update device metadata
      device.metadata = {
        ...device.metadata,
        esphomeVersion: info.esphomeVersion,
        macAddress: info.macAddress,
        model: info.model,
        projectName: info.projectName,
        projectVersion: info.projectVersion,
      };

      if (!device.manufacturer && info.projectName) {
        device.manufacturer = info.projectName.split('.')[0] || 'ESPHome';
      }

      if (!device.model) {
        device.model = info.model || info.projectName;
      }
    });

    // Handle entity discovery
    client.on(
      'entitiesComplete',
      async (entities: Map<number, ESPHomeEntity>) => {
        log(`Discovered ${entities.size} entities for ${device.name}`);

        // Create entity records for each discovered entity
        for (const [, espEntity] of entities.entries()) {
          await this.createEntityFromESPHome(device, espEntity, connection);
        }
      },
    );

    // Handle entity state changes
    client.on(
      'entityState',
      ({ entity, state }: { entity: any; state: any }) => {
        log(`ESPHome entity state received: ${entity.name} = ${state.state}`);
        const connection = this.findConnectionByEntityKey(entity.config.key);
        if (!connection) {
          log(`No connection found for ESPHome key ${entity.config.key}`);
          return;
        }

        // Find the entity ID using the mapping
        const entityId = connection.entityKeyMap.get(entity.config.key);
        if (!entityId) {
          log(`No entity found for ESPHome key ${entity.config.key}`);
          return;
        }

        log(`Processing state update for entity ${entityId}: ${state.state}`);

        // Convert ESPHome state to our StateUpdate format
        const stateUpdate: StateUpdate = {
          attrs: {
            deviceName: device.name,
            entityKey: entity.config.key,
            source: 'esphome',
            unitOfMeasurement: entity.config.unitOfMeasurement,
          },
          entityId: entityId,
          state: String(state.state),
          timestamp: new Date(),
        };

        // Send to state manager
        if (this.stateManager) {
          this.stateManager.updateState(stateUpdate);
        }

        // Notify subscribers
        const callback = connection.subscriptions.get(entityId);
        if (callback) {
          callback(stateUpdate);
        }
      },
    );

    // Handle connection events
    client.on('connect', () => {
      connection.connected = true;
      log(`Connected to ESPHome device: ${device.name}`);
    });

    client.on('disconnect', () => {
      connection.connected = false;
      log(`Disconnected from ESPHome device: ${device.name}`);
    });

    client.on('error', (error) => {
      log(`Error from ESPHome device ${device.name}:`, error);
    });
  }

  /**
   * Create entity record from ESPHome entity discovery
   */
  private async createEntityFromESPHome(
    device: {
      id: string;
      name: string;
      ipAddress?: string;
      manufacturer?: string;
      model?: string;
      metadata?: Record<string, unknown>;
    },
    espEntity: any,
    connection: ESPHomeDeviceConnection,
  ): Promise<void> {
    try {
      // Map ESPHome entity type to our EntityKind
      const entityKind = this.mapESPHomeEntityType(espEntity.type);

      // Generate entity key - use a simple format for now
      const entityKey = `${espEntity.type}.${device.name.toLowerCase().replace(/\s+/g, '_')}_${espEntity.name.toLowerCase().replace(/\s+/g, '_')}`;

      // Extract device class and build capabilities
      let deviceClass: string | undefined;
      const capabilities: import('@cove/db').EntityCapability[] = [];

      // Add type-specific properties
      const config = espEntity.config || espEntity;
      if (espEntity.type === 'sensor' && 'unitOfMeasurement' in config) {
        deviceClass = config.deviceClass;
        capabilities.push({
          precision: config.accuracyDecimals,
          type: 'numeric',
          unit: config.unitOfMeasurement,
        });
      } else if (espEntity.type === 'light' && 'supportsBrightness' in config) {
        capabilities.push({ type: 'on_off' });

        if (config.supportsBrightness) {
          capabilities.push({ max: 255, min: 0, type: 'brightness' });
        }

        if (config.supportedColorModes?.includes(2)) {
          capabilities.push({
            max_mireds: config.maxMireds,
            min_mireds: config.minMireds,
            type: 'color_temp',
          });
        }

        if (config.supportedColorModes?.includes(3)) {
          capabilities.push({ type: 'rgb' });
        }
      } else if (espEntity.type === 'number' && 'minValue' in config) {
        deviceClass = config.deviceClass;
        capabilities.push({
          max: config.maxValue,
          min: config.minValue,
          step: config.step,
          type: 'numeric',
          unit: config.unitOfMeasurement,
        });
      } else if (
        espEntity.type === 'binary_sensor' &&
        'deviceClass' in config
      ) {
        deviceClass = config.deviceClass;
        capabilities.push({ type: 'on_off' });
      } else if (espEntity.type === 'switch' && 'deviceClass' in config) {
        deviceClass = config.deviceClass;
        capabilities.push({ type: 'on_off' });
      } else if (espEntity.type === 'button' && 'deviceClass' in config) {
        deviceClass = config.deviceClass;
        capabilities.push({ type: 'on_off' });
      } else if (espEntity.type === 'text_sensor' && 'deviceClass' in config) {
        deviceClass = config.deviceClass;
        capabilities.push({ type: 'numeric' }); // Text sensors can be treated as numeric for state tracking
      }

      // Create entity in database
      if (this.db && device.id) {
        const entityId = await this.db.createEntity({
          capabilities,
          deviceClass,
          deviceId: device.id,
          key: entityKey,
          kind: entityKind,
          name: config.name,
        });

        if (entityId) {
          // Store in connection
          const protocolEntity: ProtocolEntity = {
            capabilities,
            deviceId: device.id,
            key: entityKey,
            kind: entityKind,
            name: config.name,
          };

          connection.entities.set(entityId, protocolEntity);
          // Map ESPHome's numeric key to our entity ID
          connection.entityKeyMap.set(config.key, entityId);
          log(`Created entity: ${entityId} (${entityKind}: ${entityKey})`);
        }
      }
    } catch (error) {
      log(`Failed to create entity for ${espEntity.name}:`, error);
    }
  }

  /**
   * Map ESPHome entity type to EntityKind
   */
  private mapESPHomeEntityType(esphomeType: string): EntityKind {
    switch (esphomeType) {
      case 'sensor':
        return EntityKind.Sensor;
      case 'binary_sensor':
        return EntityKind.BinarySensor;
      case 'light':
        return EntityKind.Light;
      case 'switch':
        return EntityKind.Switch;
      case 'button':
        return EntityKind.Button;
      case 'number':
        return EntityKind.Number;
      case 'select':
        return EntityKind.Select;
      case 'text':
        return EntityKind.Text;
      case 'text_sensor':
        return EntityKind.TextSensor;
      case 'time':
        return EntityKind.Time;
      case 'date':
        return EntityKind.Date;
      case 'datetime':
        return EntityKind.DateTime;
      case 'climate':
        return EntityKind.Climate;
      case 'cover':
        return EntityKind.Cover;
      case 'fan':
        return EntityKind.Fan;
      case 'lock':
        return EntityKind.Lock;
      case 'media_player':
        return EntityKind.MediaPlayer;
      case 'siren':
        return EntityKind.Siren;
      case 'camera':
        return EntityKind.Camera;
      case 'alarm_control_panel':
        return EntityKind.AlarmControlPanel;
      case 'valve':
        return EntityKind.Valve;
      case 'update':
        return EntityKind.Update;
      case 'event':
        return EntityKind.Event;
      case 'color':
        return EntityKind.Color;
      default:
        return EntityKind.Other;
    }
  }

  /**
   * Find connection by ESPHome entity key
   */
  private findConnectionByEntityKey(
    entityKey: number,
  ): ESPHomeDeviceConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.entityKeyMap.has(entityKey)) {
        return connection;
      }
    }
    return null;
  }

  // EntityAwareProtocolAdapter implementation

  async discoverEntities(deviceId: string): Promise<ProtocolEntity[]> {
    if (this.testMode) {
      return this.discoverEntitiesTestMode(deviceId);
    }

    const connection = this.connections.get(deviceId);
    if (!connection) {
      return [];
    }

    return Array.from(connection.entities.values());
  }

  /**
   * Discover entities in test mode (return mock entities)
   */
  private async discoverEntitiesTestMode(
    deviceId: string,
  ): Promise<ProtocolEntity[]> {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      return [];
    }

    // Return test entities for this device
    const entities = Array.from(this.testEntities.values());

    // Store entities in connection for consistency
    entities.forEach((entity) => {
      connection.entities.set(entity.key, entity);
    });

    log(`Discovered ${entities.length} test entities for device: ${deviceId}`);
    return entities;
  }

  subscribeEntityState(
    entityId: string,
    callback: (state: StateUpdate) => void,
  ): void {
    // Find the connection that has this entity
    for (const connection of this.connections.values()) {
      if (connection.entities.has(entityId)) {
        connection.subscriptions.set(entityId, callback);
        log(`Subscribed to entity state: ${entityId}`);
        return;
      }
    }
    log(`Entity not found for subscription: ${entityId}`);
  }

  unsubscribeEntityState(entityId: string): void {
    // Find the connection that has this entity
    for (const connection of this.connections.values()) {
      if (connection.subscriptions.has(entityId)) {
        connection.subscriptions.delete(entityId);
        log(`Unsubscribed from entity state: ${entityId}`);
        return;
      }
    }
  }

  async sendEntityCommand(
    entityId: string,
    capability: string,
    value: unknown,
  ): Promise<boolean> {
    try {
      // Find the connection that has this entity
      for (const connection of this.connections.values()) {
        const entity = connection.entities.get(entityId);
        if (!entity) continue;

        // Find the ESPHome entity key from our mapping
        const espHomeKey = this.findESPHomeKeyByEntityId(entityId, connection);
        if (espHomeKey === null) {
          log(`No ESPHome key found for entity ${entityId}`);
          continue;
        }

        // Get the ESPHome entity to determine its type
        const espEntity = connection.client
          .getEntities()
          .find((e) => e.config.key === espHomeKey);
        if (!espEntity) {
          log(`ESPHome entity not found for key ${espHomeKey}`);
          continue;
        }

        // Send command based on entity type and capability
        let success = false;

        // Determine entity type from the entity's class name or config
        const entityType = espEntity.constructor.name
          .toLowerCase()
          .replace('entity', '');

        if (entityType === 'light') {
          success = await this.sendLightCommand(
            connection.client,
            espHomeKey,
            capability,
            value,
          );
        } else if (entityType === 'switch') {
          success = await this.sendSwitchCommand(
            connection.client,
            espHomeKey,
            capability,
            value,
          );
        } else if (entityType === 'number') {
          success = await this.sendNumberCommand(
            connection.client,
            espHomeKey,
            capability,
            value,
          );
        } else if (entityType === 'button') {
          success = await this.sendButtonCommand(
            connection.client,
            espHomeKey,
            capability,
            value,
          );
        } else {
          log(`Unsupported entity type for commands: ${entityType}`);
          continue;
        }

        if (success) {
          log(
            `Successfully sent command to entity ${entityId}: ${capability} = ${value}`,
          );
          return true;
        }
      }

      log(`No connection found for entity ${entityId}`);
      return false;
    } catch (error) {
      log(`Failed to send command to entity ${entityId}:`, error);
      return false;
    }
  }

  /**
   * Find ESPHome entity key by entityId
   */
  private findESPHomeKeyByEntityId(
    entityId: string,
    connection: ESPHomeDeviceConnection,
  ): number | null {
    for (const [espKey, mappedEntityId] of connection.entityKeyMap.entries()) {
      if (mappedEntityId === entityId) {
        return espKey;
      }
    }
    return null;
  }

  /**
   * Send light command
   */
  private async sendLightCommand(
    client: ESPHomeNativeClient,
    key: number,
    capability: string,
    value: unknown,
  ): Promise<boolean> {
    try {
      if (capability === 'on_off') {
        await client.lightCommand(key, { state: Boolean(value) });
      } else if (capability === 'brightness') {
        // Convert brightness to float between 0.0 and 1.0
        const brightness = Math.max(0, Math.min(1, Number(value) / 255));
        await client.lightCommand(key, { brightness });
      } else if (capability === 'color_temp') {
        await client.lightCommand(key, { colorTemperature: Number(value) });
      } else if (capability === 'rgb') {
        const rgb = Array.isArray(value) ? value : [255, 255, 255];
        // Convert RGB values to floats between 0.0 and 1.0
        await client.lightCommand(key, {
          blue: Math.max(0, Math.min(1, (rgb[2] || 255) / 255)),
          green: Math.max(0, Math.min(1, (rgb[1] || 255) / 255)),
          red: Math.max(0, Math.min(1, (rgb[0] || 255) / 255)),
        });
      } else {
        log(`Unsupported light capability: ${capability}`);
        return false;
      }
      return true;
    } catch (error) {
      log('Failed to send light command:', error);
      return false;
    }
  }

  /**
   * Send switch command
   */
  private async sendSwitchCommand(
    client: ESPHomeNativeClient,
    key: number,
    capability: string,
    value: unknown,
  ): Promise<boolean> {
    try {
      if (capability === 'on_off') {
        await client.switchCommand(key, Boolean(value));
      } else {
        log(`Unsupported switch capability: ${capability}`);
        return false;
      }
      return true;
    } catch (error) {
      log('Failed to send switch command:', error);
      return false;
    }
  }

  /**
   * Send number command
   */
  private async sendNumberCommand(
    client: ESPHomeNativeClient,
    key: number,
    capability: string,
    value: unknown,
  ): Promise<boolean> {
    try {
      if (capability === 'numeric') {
        await client.numberCommand(key, Number(value));
      } else {
        log(`Unsupported number capability: ${capability}`);
        return false;
      }
      return true;
    } catch (error) {
      log('Failed to send number command:', error);
      return false;
    }
  }

  /**
   * Send button command
   */
  private async sendButtonCommand(
    client: ESPHomeNativeClient,
    key: number,
    capability: string,
    value: unknown,
  ): Promise<boolean> {
    try {
      if (capability === 'on_off' && Boolean(value)) {
        await client.buttonCommand(key);
      } else {
        log(`Unsupported button capability: ${capability}`);
        return false;
      }
      return true;
    } catch (error) {
      log('Failed to send button command:', error);
      return false;
    }
  }

  /**
   * Reconnect to existing ESPHome devices
   */
  async reconnectDevices(devices: Device[]): Promise<void> {
    log(`Reconnecting ${devices.length} ESPHome devices`);

    for (const device of devices) {
      // Skip devices that don't have IP address or aren't ESPHome devices
      if (!device.ipAddress || device.protocol !== 'esphome') {
        continue;
      }

      // Skip devices that are already connected
      if (this.connections.has(device.id)) {
        log(`Device ${device.name} already connected, skipping`);
        continue;
      }

      try {
        await this.connectDevice({
          id: device.id,
          ipAddress: device.ipAddress,
          manufacturer: device.manufacturer ?? undefined,
          metadata: device.metadata ?? undefined,
          model: device.model ?? undefined,
          name: device.name,
        });
        log(
          `Reconnected ESPHome device: ${device.name} at ${device.ipAddress}`,
        );
      } catch (error) {
        log(`Failed to reconnect ESPHome device ${device.name}:`, error);
      }
    }

    log('Finished reconnecting ESPHome devices');
  }
}

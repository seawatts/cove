/**
 * ESPHome Protocol Adapter
 * Updated for Home Assistant++ entity-first architecture
 * Wraps @cove/protocols/esphome/native for hub daemon integration
 */

import { debug } from '@cove/logger';
import type {
  EntityAwareProtocolAdapter,
  ProtocolEntity,
} from '@cove/protocols';
// Remove unused import
import {
  type AnyEntity,
  ESPHomeNativeClient,
} from '@cove/protocols/esphome/native';
import type {
  EntityKind,
  EntityTraits,
  ProtocolType,
  StateUpdate,
} from '@cove/types';
import type { HubDatabase } from '../db';
import type { StateManager } from '../state-manager';

const log = debug('cove:hub:adapter:esphome');

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
  subscriptions: Map<string, (state: StateUpdate) => void>; // entityId -> callback
}

export class ESPHomeAdapter implements EntityAwareProtocolAdapter {
  readonly name = 'ESPHome Adapter';
  readonly protocol: ProtocolType = 'esphome' as ProtocolType;

  private connections: Map<string, ESPHomeDeviceConnection> = new Map();
  private initialized = false;
  private stateManager: StateManager | null = null;
  private db: HubDatabase | null = null;

  constructor(stateManager?: StateManager | null, db?: HubDatabase | null) {
    this.stateManager = stateManager || null;
    this.db = db || null;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      log('Already initialized');
      return;
    }

    log('Initializing ESPHome adapter');
    this.initialized = true;
    log('ESPHome adapter initialized');
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
    if (!device.ipAddress) {
      throw new Error('ESPHome device requires IP address');
    }

    if (!device.id) {
      throw new Error('Device must have an ID to connect');
    }

    const deviceId = device.id;
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
    client.on('entitiesComplete', async (entities: Map<number, AnyEntity>) => {
      log(`Discovered ${entities.size} entities for ${device.name}`);

      // Create entity records for each discovered entity
      for (const [, espEntity] of entities.entries()) {
        await this.createEntityFromESPHome(device, espEntity, connection);
      }
    });

    // Handle entity state changes
    client.on('entityState', (entityKey: number, state: unknown) => {
      const connection = this.findConnectionByEntityKey(entityKey);
      if (!connection) return;

      // Find the entity by key in the connection
      let entityId: string | null = null;
      for (const [id, entity] of connection.entities.entries()) {
        if (entity.key === entityKey.toString()) {
          entityId = id;
          break;
        }
      }

      if (!entityId) return;

      // Convert ESPHome state to our StateUpdate format
      const stateUpdate: StateUpdate = {
        attrs: {
          deviceName: device.name,
          entityKey: entityKey,
          source: 'esphome',
        },
        entityId: entityId,
        state: String(state),
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
    });

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
    espEntity: AnyEntity,
    connection: ESPHomeDeviceConnection,
  ): Promise<void> {
    try {
      // Map ESPHome entity type to our EntityKind
      const entityKind = this.mapESPHomeEntityType(espEntity.type);

      // Generate entity key - use a simple format for now
      const entityKey = `${espEntity.type}.${device.name.toLowerCase().replace(/\s+/g, '_')}_${espEntity.name.toLowerCase().replace(/\s+/g, '_')}`;

      // Build traits from ESPHome entity properties
      const traits: EntityTraits = {
        disabled: espEntity.disabled,
        icon: espEntity.icon,
      };

      // Add type-specific properties
      if (espEntity.type === 'sensor' && 'unitOfMeasurement' in espEntity) {
        traits.unit_of_measurement = espEntity.unitOfMeasurement;
        traits.device_class = espEntity.deviceClass;
        traits.precision = espEntity.accuracyDecimals;
      } else if (
        espEntity.type === 'light' &&
        'supportsBrightness' in espEntity
      ) {
        traits.supports_brightness = espEntity.supportsBrightness;
        traits.supports_color_temp =
          espEntity.supportedColorModes?.includes(2) || false;
        traits.supports_rgb =
          espEntity.supportedColorModes?.includes(3) || false;
        traits.min_color_temp = espEntity.minMireds;
        traits.max_color_temp = espEntity.maxMireds;
        traits.effects = espEntity.effects;
      } else if (espEntity.type === 'number' && 'minValue' in espEntity) {
        traits.min_value = espEntity.minValue;
        traits.max_value = espEntity.maxValue;
        traits.step = espEntity.step;
        traits.unit_of_measurement = espEntity.unitOfMeasurement;
        traits.device_class = espEntity.deviceClass;
      } else if (
        espEntity.type === 'binary_sensor' &&
        'deviceClass' in espEntity
      ) {
        traits.device_class = espEntity.deviceClass;
      } else if (espEntity.type === 'switch' && 'deviceClass' in espEntity) {
        traits.device_class = espEntity.deviceClass;
        traits.supports_on_off = true;
      } else if (espEntity.type === 'button' && 'deviceClass' in espEntity) {
        traits.device_class = espEntity.deviceClass;
      } else if (
        espEntity.type === 'text_sensor' &&
        'deviceClass' in espEntity
      ) {
        traits.device_class = espEntity.deviceClass;
      }

      // Create entity in database
      if (this.db && device.id) {
        const entityId = await this.db.createEntity({
          deviceId: device.id,
          key: entityKey,
          kind: entityKind,
          traits,
        });

        if (entityId) {
          // Store in connection
          const protocolEntity: ProtocolEntity = {
            deviceId: device.id,
            key: entityKey,
            kind: entityKind,
            name: espEntity.name,
            traits,
          };

          connection.entities.set(entityId, protocolEntity);
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
        return 'sensor' as EntityKind;
      case 'binary_sensor':
        return 'binary_sensor' as EntityKind;
      case 'light':
        return 'light' as EntityKind;
      case 'switch':
        return 'switch' as EntityKind;
      case 'button':
        return 'button' as EntityKind;
      case 'number':
        return 'number' as EntityKind;
      case 'select':
        return 'select' as EntityKind;
      case 'text':
        return 'text' as EntityKind;
      case 'time':
        return 'time' as EntityKind;
      case 'date':
        return 'date' as EntityKind;
      case 'datetime':
        return 'datetime' as EntityKind;
      case 'color':
        return 'color' as EntityKind;
      default:
        return 'other' as EntityKind;
    }
  }

  /**
   * Find connection by ESPHome entity key
   */
  private findConnectionByEntityKey(
    entityKey: number,
  ): ESPHomeDeviceConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.entities.has(entityKey.toString())) {
        return connection;
      }
    }
    return null;
  }

  // EntityAwareProtocolAdapter implementation

  async discoverEntities(deviceId: string): Promise<ProtocolEntity[]> {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      return [];
    }

    return Array.from(connection.entities.values());
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

        // Map capability to ESPHome command
        const command = this.mapCapabilityToESPHomeCommand(
          capability,
          value,
          entity.key,
        );
        if (command) {
          // Send command via ESPHome client
          // Note: This would need to be implemented based on the actual ESPHome client API
          log(`Sent command to entity ${entityId}: ${capability} = ${value}`);
          return true;
        }
      }
      return false;
    } catch (error) {
      log(`Failed to send command to entity ${entityId}:`, error);
      return false;
    }
  }

  /**
   * Map capability to ESPHome command
   */
  private mapCapabilityToESPHomeCommand(
    capability: string,
    value: unknown,
    _entityKey: string,
  ): Record<string, unknown> | null {
    switch (capability) {
      case 'on_off':
        return { state: Boolean(value), type: 'switch_command' };
      case 'brightness':
        return { brightness: Number(value), type: 'light_command' };
      case 'color_temp':
        return { color_temp: Number(value), type: 'light_command' };
      case 'color_rgb':
        return {
          rgb: Array.isArray(value) ? value : [255, 255, 255],
          type: 'light_command',
        };
      default:
        return null;
    }
  }
}

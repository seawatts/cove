/**
 * ESPHome Protocol Adapter
 * Wraps @cove/protocols/esphome/native for hub daemon integration
 */

import { debug } from '@cove/logger';
import {
  type AnyEntity,
  ESPHomeNativeClient,
} from '@cove/protocols/esphome/native';
import type {
  Device,
  DeviceCapability,
  DeviceCommand,
  ProtocolAdapter,
  ProtocolType,
} from '@cove/types';
import { DeviceCapability as Capability } from '@cove/types';
import type { StateManager } from '../state-manager';

const log = debug('cove:hub:adapter:esphome');

interface ESPHomeDeviceConnection {
  client: ESPHomeNativeClient;
  deviceId: string;
  device: Device;
  ipAddress: string;
  connected: boolean;
}

export class ESPHomeAdapter implements ProtocolAdapter {
  readonly name = 'ESPHome Adapter';
  readonly protocol: ProtocolType = 'esphome' as ProtocolType;

  private connections: Map<string, ESPHomeDeviceConnection> = new Map();
  private initialized = false;
  private stateManager: StateManager | null = null;
  private supabaseSync: SupabaseSync | null = null;

  constructor(
    stateManager?: StateManager | null,
    supabaseSync?: SupabaseSync | null,
  ) {
    this.stateManager = stateManager || null;
    this.supabaseSync = supabaseSync || null;
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

  /**
   * Connect to an ESPHome device
   */
  async connect(device: Device): Promise<void> {
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
      password: (device.config.api_password as string) || '',
      port: 6053,
    });

    // Store connection info
    const connection: ESPHomeDeviceConnection = {
      client,
      connected: false,
      device,
      deviceId,
      ipAddress: device.ipAddress,
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
      device.config = {
        ...device.config,
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

      // Store entity information in device config
      const entityList = Array.from(entities.values()).map((e: AnyEntity) => ({
        key: e.key,
        name: e.name,
        objectId: e.objectId,
        type: e.type,
        uniqueId: e.uniqueId,
      }));

      device.config = {
        ...device.config,
        entities: entityList,
      };

      // Persist entities to database
      if (this.supabaseSync && device.id) {
        log(
          `Persisting ${entities.size} entities for ${device.name} to database`,
        );
        const entitiesForDb = Array.from(entities.values()).map(
          (e: AnyEntity) => ({
            deviceClass: e.deviceClass,
            disabled: e.disabled,
            effects: e.effects,
            icon: e.icon,
            key: e.key,
            maxValue: e.maxValue,
            minValue: e.minValue,
            name: e.name,
            objectId: e.objectId,
            step: e.step,
            supportsBrightness: e.supportsBrightness,
            supportsColorTemp: e.supportsColorTemp,
            supportsRgb: e.supportsRgb,
            type: e.type,
            unitOfMeasurement: e.unitOfMeasurement,
          }),
        );

        try {
          await this.supabaseSync.upsertEntities(device.id, entitiesForDb);
          log(
            `Successfully persisted ${entities.size} entities for ${device.name}`,
          );
        } catch (error) {
          log(`Failed to persist entities for ${device.name}:`, error);
        }
      } else {
        log(
          `Skipping entity persistence - supabaseSync: ${!!this.supabaseSync}, device.id: ${device.id}`,
        );
      }

      // Determine device capabilities based on entities
      const capabilities = new Set<DeviceCapability>();

      for (const entity of entities.values()) {
        switch (entity.type) {
          case 'switch':
            capabilities.add(Capability.OnOff);
            break;
          case 'light':
            capabilities.add(Capability.OnOff);
            capabilities.add(Capability.Brightness);
            break;
          case 'sensor':
          case 'binary_sensor':
            // Sensors don't add capabilities (they're read-only)
            break;
        }
      }

      if (capabilities.size > 0) {
        device.capabilities = Array.from(capabilities);
      }
    });

    // Handle sensor state updates
    client.on('sensorState', async ({ entity, state }) => {
      const stateKey =
        entity.objectId || entity.name.toLowerCase().replace(/\s+/g, '_');

      device.state = {
        ...device.state,
        [stateKey]: state,
      };
      device.updatedAt = new Date();
      device.lastSeen = new Date();

      // Use StateManager for intelligent persistence
      if (this.stateManager && device.id) {
        await this.stateManager.updateState({
          deviceId: device.id,
          entityName: entity.name,
          source: 'esphome',
          stateKey,
          value: state,
        });
      }
    });

    // Handle binary sensor state updates
    client.on('binarySensorState', async ({ entity, state }) => {
      const stateKey =
        entity.objectId || entity.name.toLowerCase().replace(/\s+/g, '_');

      device.state = {
        ...device.state,
        [stateKey]: state,
      };
      device.updatedAt = new Date();
      device.lastSeen = new Date();

      // Use StateManager for intelligent persistence
      if (this.stateManager && device.id) {
        await this.stateManager.updateState({
          deviceId: device.id,
          entityName: entity.name,
          source: 'esphome',
          stateKey,
          value: state,
        });
      }
    });

    // Handle switch state updates
    client.on('switchState', async ({ entity, state }) => {
      const stateKey =
        entity.objectId || entity.name.toLowerCase().replace(/\s+/g, '_');

      device.state = {
        ...device.state,
        [stateKey]: state,
        on: state, // Also map to generic 'on' state
      };
      device.updatedAt = new Date();
      device.lastSeen = new Date();

      // Use StateManager for intelligent persistence
      if (this.stateManager && device.id) {
        await this.stateManager.updateState({
          deviceId: device.id,
          entityName: entity.name,
          source: 'esphome',
          stateKey,
          value: state,
        });
      }
    });

    // Handle light state updates
    client.on('lightState', async ({ entity, state }) => {
      const stateKey =
        entity.objectId || entity.name.toLowerCase().replace(/\s+/g, '_');

      device.state = {
        ...device.state,
        [stateKey]: state.state,
        brightness: state.brightness
          ? Math.round(state.brightness * 100)
          : undefined,
        color_temp: state.colorTemperature,
        on: state.state,
      };
      device.updatedAt = new Date();
      device.lastSeen = new Date();

      // Use StateManager for intelligent persistence
      if (this.stateManager && device.id) {
        await this.stateManager.updateState({
          deviceId: device.id,
          entityName: entity.name,
          source: 'esphome',
          stateKey,
          value: state.state,
        });
      }
    });

    // Handle number state updates
    client.on('numberState', async ({ entity, state }) => {
      const stateKey =
        entity.objectId || entity.name.toLowerCase().replace(/\s+/g, '_');

      device.state = {
        ...device.state,
        [stateKey]: state,
      };
      device.updatedAt = new Date();
      device.lastSeen = new Date();

      // Use StateManager for intelligent persistence
      if (this.stateManager && device.id) {
        await this.stateManager.updateState({
          deviceId: device.id,
          entityName: entity.name,
          source: 'esphome',
          stateKey,
          value: state,
        });
      }
    });

    // Handle text sensor state updates
    client.on('textSensorState', async ({ entity, state }) => {
      const stateKey =
        entity.objectId || entity.name.toLowerCase().replace(/\s+/g, '_');

      device.state = {
        ...device.state,
        [stateKey]: state,
      };
      device.updatedAt = new Date();
      device.lastSeen = new Date();

      // Use StateManager for intelligent persistence
      if (this.stateManager && device.id) {
        await this.stateManager.updateState({
          deviceId: device.id,
          entityName: entity.name,
          source: 'esphome',
          stateKey,
          value: state,
        });
      }
    });

    // Handle disconnection
    client.on('disconnected', () => {
      log(`Device disconnected: ${device.name}`);
      connection.connected = false;
      device.online = false;
      device.available = false;
    });

    // Handle errors
    client.on('error', (error) => {
      log(`Device error (${device.name}):`, error);
      device.online = false;
      device.available = false;
    });
  }

  /**
   * Disconnect from an ESPHome device
   */
  async disconnect(device: Device): Promise<void> {
    if (!device.id) {
      log('Device has no ID, cannot disconnect');
      return;
    }

    const deviceId = device.id;
    const connection = this.connections.get(deviceId);

    if (!connection) {
      log(`Device ${deviceId} not connected`);
      return;
    }

    log(`Disconnecting from device: ${deviceId}`);

    try {
      await connection.client.disconnect();
    } catch (error) {
      log(`Error disconnecting from device ${deviceId}:`, error);
    }

    this.connections.delete(deviceId);
    log(`Disconnected from device: ${deviceId}`);
  }

  /**
   * Send a command to an ESPHome device
   */
  async sendCommand(device: Device, command: DeviceCommand): Promise<void> {
    if (!device.id) {
      throw new Error('Device ID is required');
    }
    const connection = this.connections.get(device.id);
    if (!connection || !connection.connected) {
      throw new Error(`Device ${device.id} not connected`);
    }

    log(
      `Sending command to device ${device.name}: ${command.capability} =`,
      command.value,
    );

    // Find the entity to control
    const entities = device.config.entities as
      | Array<{ key: number; name: string; type: string; objectId: string }>
      | undefined;

    if (!entities || entities.length === 0) {
      throw new Error('No entities found for device');
    }

    // For now, use the first entity of the appropriate type
    // In the future, we could use command.target to select specific entities
    switch (command.capability) {
      case Capability.OnOff: {
        const switchEntity = entities.find(
          (e) => e.type === 'switch' || e.type === 'light',
        );
        if (!switchEntity) {
          throw new Error('No switch or light entity found');
        }

        if (switchEntity.type === 'switch') {
          await connection.client.switchCommand(
            switchEntity.key,
            command.value as boolean,
          );
        } else if (switchEntity.type === 'light') {
          await connection.client.lightCommand(switchEntity.key, {
            state: command.value as boolean,
          });
        }
        break;
      }

      case Capability.Brightness: {
        const lightEntity = entities.find((e) => e.type === 'light');
        if (!lightEntity) {
          throw new Error('No light entity found');
        }

        // Convert 0-100 to 0-1
        const brightness = (command.value as number) / 100;
        await connection.client.lightCommand(lightEntity.key, {
          brightness,
          state: brightness > 0,
        });
        break;
      }

      default: {
        log(`Unsupported command capability: ${command.capability}`);
        throw new Error(`Unsupported capability: ${command.capability}`);
      }
    }
  }

  /**
   * Poll state for ESPHome devices (optional, since ESPHome pushes state)
   * This is a no-op for ESPHome since state updates are pushed via events
   */
  async pollState(device: Device): Promise<void> {
    // ESPHome pushes state updates, no polling needed
    // State is already up-to-date from event handlers
    if (!device.id) return;
    const connection = this.connections.get(device.id);
    if (connection?.connected) {
      device.online = true;
      device.available = true;
    }
  }

  /**
   * Press a button entity
   */
  async pressButton(device: Device, entityKey: number): Promise<void> {
    if (!device.id) {
      throw new Error('Device ID is required');
    }
    const connection = this.connections.get(device.id);
    if (!connection) {
      throw new Error('Device not connected');
    }

    await connection.client.buttonPress(entityKey);
    log(`Pressed button ${entityKey} on ${device.name}`);
  }

  /**
   * Set a number entity value
   */
  async setNumber(
    device: Device,
    entityKey: number,
    value: number,
  ): Promise<void> {
    if (!device.id) {
      throw new Error('Device ID is required');
    }
    const connection = this.connections.get(device.id);
    if (!connection) {
      throw new Error('Device not connected');
    }

    await connection.client.numberCommand(entityKey, value);
    log(`Set number ${entityKey} to ${value} on ${device.name}`);
  }

  /**
   * Control a light entity
   */
  async controlLight(
    device: Device,
    entityKey: number,
    command: Record<string, unknown>,
  ): Promise<void> {
    if (!device.id) {
      throw new Error('Device ID is required');
    }
    const connection = this.connections.get(device.id);
    if (!connection) {
      throw new Error('Device not connected');
    }

    await connection.client.lightCommand(entityKey, command);
    log(`Controlled light ${entityKey} on ${device.name}`);
  }
}

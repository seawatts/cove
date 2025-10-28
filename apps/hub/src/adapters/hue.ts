/**
 * Philips Hue Protocol Adapter
 * Updated for Home Assistant-inspired entity-first architecture
 * Wraps @cove/protocols/hue for hub daemon integration
 */

import { debug } from '@cove/logger';
import type {
  EntityAwareProtocolAdapter,
  ProtocolEntity,
} from '@cove/protocols';
import {
  findEntityMapping,
  generateEntityKey,
  HUE_ENTITY_MAPPINGS,
} from '@cove/protocols';
import { HueClient } from '@cove/protocols/hue';
import type { Device, ProtocolType, StateUpdate } from '@cove/types';
import { EntityKind } from '@cove/types';
import type { HubDatabase } from '../db';
import type { StateManager } from '../state-manager';

const log = debug('cove:hub:adapter:hue');

interface HueLight {
  id: string;
  name: string;
  type: string;
  state: {
    on: boolean;
    bri?: number;
    hue?: number;
    sat?: number;
    ct?: number;
    reachable: boolean;
  };
  uniqueid: string;
  manufacturername: string;
  modelid: string;
  room?: string;
}

interface HueBridgeConnection {
  client: HueClient;
  bridgeId: string;
  ipAddress: string;
  authenticated: boolean;
  username?: string;
  device: Device; // The bridge device
  lights: Map<string, HueLight>; // Map of Hue light IDs to HueLight objects
  entities: Map<string, ProtocolEntity>; // Map of entity IDs to ProtocolEntity
  entityToLightId: Map<string, string>; // Map of entity IDs to Hue light IDs
  subscriptions: Map<string, (state: StateUpdate) => void>; // entityId -> callback
}

export class HueAdapter implements EntityAwareProtocolAdapter {
  readonly name = 'Hue Adapter';
  readonly protocol: ProtocolType = 'hue' as ProtocolType;

  private bridges: Map<string, HueBridgeConnection> = new Map();
  private initialized = false;
  private stateManager: StateManager | null = null;
  private db: HubDatabase | null = null;
  private testMode = false;
  private testLights: Map<string, HueLight> = new Map();

  constructor(
    stateManager?: StateManager | null,
    db?: HubDatabase | null,
    testMode = false,
  ) {
    this.stateManager = stateManager || null;
    this.db = db || null;
    this.testMode = testMode;

    if (testMode) {
      this.initializeTestLights();
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      log('Already initialized');
      return;
    }

    if (this.testMode) {
      log('Initializing Hue adapter in test mode');
    } else {
      log('Initializing Hue adapter');
    }

    this.initialized = true;
    log('Hue adapter initialized');
  }

  /**
   * Initialize test lights for simulation
   */
  private initializeTestLights(): void {
    // Create mock lights for testing
    const testLight1: HueLight = {
      id: '1',
      manufacturername: 'Philips',
      modelid: 'LCT015',
      name: 'Test Living Room Light',
      room: 'Living Room',
      state: {
        bri: 0,
        ct: 500,
        hue: 0,
        on: false,
        reachable: true,
        sat: 0,
      },
      type: 'Extended color light',
      uniqueid: 'test-light-1',
    };

    const testLight2: HueLight = {
      id: '2',
      manufacturername: 'Philips',
      modelid: 'LWB014',
      name: 'Test Bedroom Light',
      room: 'Bedroom',
      state: {
        bri: 128,
        on: true,
        reachable: true,
      },
      type: 'Dimmable light',
      uniqueid: 'test-light-2',
    };

    this.testLights.set('1', testLight1);
    this.testLights.set('2', testLight2);
  }

  /**
   * Connect to device in test mode (simulated)
   */
  private async connectDeviceTestMode(device: Device): Promise<void> {
    const bridgeId = device.id;

    // Create simulated connection
    const connection: HueBridgeConnection = {
      authenticated: true,
      bridgeId,
      client: null as any, // Not used in test mode
      device,
      entities: new Map(),
      entityToLightId: new Map(),
      ipAddress: device.ipAddress || '192.168.1.100',
      lights: new Map(),
      subscriptions: new Map(),
      username: 'test-user',
    };

    this.bridges.set(bridgeId, connection);
    log(`Connected to test bridge: ${device.name}`);
  }

  async shutdown(): Promise<void> {
    log('Shutting down Hue adapter');

    // Disconnect all bridges
    for (const [bridgeId, connection] of this.bridges.entries()) {
      try {
        await connection.client.disconnect();
        log(`Disconnected from bridge: ${bridgeId}`);
      } catch (error) {
        log(`Error disconnecting from bridge ${bridgeId}:`, error);
      }
    }

    this.bridges.clear();
    this.initialized = false;
    log('Hue adapter shut down');
  }

  async startDiscovery(): Promise<void> {
    log('Hue discovery is handled by @cove/discovery mDNS service');
    // Discovery is handled by the main discovery service
    // This adapter just receives connect() calls for discovered bridges
  }

  async stopDiscovery(): Promise<void> {
    // No-op, discovery is handled externally
  }

  /**
   * Connect to a Hue bridge device
   */
  async connectDevice(device: Device): Promise<void> {
    if (!device.id) {
      throw new Error('Device must have an ID to connect');
    }

    const bridgeId = device.id;

    if (this.testMode) {
      log(`Connecting to Hue bridge in test mode: ${device.name}`);
      return this.connectDeviceTestMode(device);
    }

    if (!device.ipAddress) {
      throw new Error('Hue bridge requires IP address');
    }

    log(`Connecting to Hue bridge: ${device.name} at ${device.ipAddress}`);

    // Check if already connected
    if (this.bridges.has(bridgeId)) {
      log(`Already connected to bridge: ${bridgeId}`);
      return;
    }

    // Create client
    const client = new HueClient({
      host: device.ipAddress,
      useHttps: true,
      username: device.metadata?.api_key as string | undefined,
    });

    // Store connection info (not yet authenticated)
    const connection: HueBridgeConnection = {
      authenticated: false,
      bridgeId,
      client,
      device,
      entities: new Map(),
      entityToLightId: new Map(),
      ipAddress: device.ipAddress,
      lights: new Map(),
      subscriptions: new Map(),
      username: device.metadata?.api_key as string | undefined,
    };

    this.bridges.set(bridgeId, connection);

    // If we have a username, try to connect
    if (connection.username) {
      try {
        await client.connect();
        connection.authenticated = true;
        log(`Successfully connected to bridge: ${bridgeId}`);

        // Discover lights on this bridge and create entities
        await this.discoverLights(connection);
      } catch (error) {
        log(`Failed to connect to bridge ${bridgeId}:`, error);
        // Keep the connection in the map, but mark as not authenticated
        // User will need to re-authenticate
      }
    } else {
      log(`Bridge ${bridgeId} requires authentication (no api_key in config)`);
    }
  }

  /**
   * Authenticate with a Hue bridge (requires physical button press)
   */
  async authenticate(bridgeId: string, appName = 'cove-hub'): Promise<string> {
    const connection = this.bridges.get(bridgeId);
    if (!connection) {
      throw new Error(`Bridge ${bridgeId} not connected`);
    }

    log(`Authenticating with bridge: ${bridgeId}`);
    const username = await connection.client.authenticate(appName);

    connection.username = username;
    connection.authenticated = true;

    log(`Successfully authenticated with bridge: ${bridgeId}`);
    return username;
  }

  /**
   * Discover lights on bridge and create entities
   */
  private async discoverLights(connection: HueBridgeConnection): Promise<void> {
    try {
      const lights = await connection.client.getLights();
      log(
        `Discovered ${Object.keys(lights).length} lights on bridge ${connection.bridgeId}`,
      );

      for (const [lightId, light] of Object.entries(lights)) {
        // Store light info
        const hueLight: HueLight = {
          id: lightId,
          manufacturername: light.manufacturername,
          modelid: light.modelid,
          name: light.name,
          state: {
            ...light.state,
            reachable: light.state.reachable ?? false,
          },
          type: light.type,
          uniqueid: light.uniqueid,
        };

        connection.lights.set(lightId, hueLight);

        // Create entity for this light
        await this.createEntityFromHueLight(connection, hueLight);
      }
    } catch (error) {
      log(`Failed to discover lights on bridge ${connection.bridgeId}:`, error);
    }
  }

  /**
   * Create entity record from Hue light
   */
  private async createEntityFromHueLight(
    connection: HueBridgeConnection,
    light: HueLight,
  ): Promise<void> {
    try {
      // Map Hue light type to our EntityKind
      const entityKind = this.mapHueLightType(light.type);

      // Generate entity key
      const foundMapping = findEntityMapping(
        'hue',
        'light',
        HUE_ENTITY_MAPPINGS,
      );
      // HUE_ENTITY_MAPPINGS is guaranteed to have at least one element
      const mapping =
        foundMapping ??
        (HUE_ENTITY_MAPPINGS[0] as NonNullable<
          (typeof HUE_ENTITY_MAPPINGS)[0]
        >);
      const entityKey = generateEntityKey(
        mapping,
        light.name,
        light.name,
        light.room,
      );

      // Build capabilities from Hue light properties
      const capabilities: import('@cove/db').EntityCapability[] = [];

      // All Hue lights support on/off
      capabilities.push({ type: 'on_off' });

      // Add brightness if supported
      if (light.state.bri !== undefined) {
        capabilities.push({ max: 100, min: 0, type: 'brightness', unit: '%' });
      }

      // Add color temperature if supported
      if (light.state.ct !== undefined) {
        capabilities.push({
          max_mireds: 500,
          min_mireds: 153,
          type: 'color_temp',
        });
      }

      // Add RGB if supported
      if (light.state.hue !== undefined && light.state.sat !== undefined) {
        capabilities.push({ type: 'rgb' });
      }

      // Create entity in database
      if (this.db && connection.device.id) {
        const entityId = await this.db.createEntity({
          capabilities,
          deviceClass: undefined, // Hue lights don't have a specific device class
          deviceId: connection.device.id,
          key: entityKey,
          kind: entityKind,
          name: light.name,
        });

        if (entityId) {
          // Store in connection
          const protocolEntity: ProtocolEntity = {
            capabilities,
            deviceId: connection.device.id,
            key: entityKey,
            kind: entityKind,
            name: light.name,
          };

          connection.entities.set(entityId, protocolEntity);
          connection.entityToLightId.set(entityId, light.id);
          log(`Created entity: ${entityId} (${entityKind}: ${entityKey})`);

          // Send initial state
          await this.updateLightState(connection, light, entityId);
        }
      }
    } catch (error) {
      log(`Failed to create entity for ${light.name}:`, error);
    }
  }

  /**
   * Map Hue light type to EntityKind
   */
  private mapHueLightType(hueType: string): EntityKind {
    switch (hueType) {
      case 'Extended color light':
      case 'Color light':
        return EntityKind.Light;
      case 'Dimmable light':
        return EntityKind.Light;
      case 'On/Off light':
        return EntityKind.Light;
      default:
        return EntityKind.Light;
    }
  }

  /**
   * Update light state and send to state manager
   */
  private async updateLightState(
    connection: HueBridgeConnection,
    light: HueLight,
    entityId: string,
  ): Promise<void> {
    try {
      // Convert Hue state to our state format
      let state = light.state.on ? 'on' : 'off';

      // Add brightness if available
      if (light.state.bri !== undefined) {
        state += `, brightness: ${Math.round((light.state.bri / 254) * 100)}%`;
      }

      // Add color temperature if available
      if (light.state.ct !== undefined) {
        state += `, color_temp: ${light.state.ct}`;
      }

      // Add RGB if available
      if (light.state.hue !== undefined && light.state.sat !== undefined) {
        const rgb = this.hueSatToRgb(light.state.hue, light.state.sat);
        state += `, rgb: [${rgb[0]}, ${rgb[1]}, ${rgb[2]}]`;
      }

      const stateUpdate: StateUpdate = {
        attrs: {
          brightness: light.state.bri,
          color_temp: light.state.ct,
          hue: light.state.hue,
          hue_light_id: light.id,
          reachable: light.state.reachable,
          sat: light.state.sat,
          source: 'hue',
        },
        entityId,
        state,
        timestamp: new Date(),
      };

      // Send to state manager
      if (this.stateManager) {
        await this.stateManager.updateState(stateUpdate);
      }

      // Notify subscribers
      const callback = connection.subscriptions.get(entityId);
      if (callback) {
        callback(stateUpdate);
      }
    } catch (error) {
      log(`Failed to update state for light ${light.name}:`, error);
    }
  }

  /**
   * Convert Hue hue/sat to RGB
   */
  private hueSatToRgb(hue: number, sat: number): [number, number, number] {
    const h = hue / 182.04; // Hue is 0-65535, convert to 0-360
    const s = sat / 254; // Sat is 0-254, convert to 0-1
    const v = 1; // Assume max value for now

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h >= 0 && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else if (h >= 300 && h < 360) {
      r = c;
      g = 0;
      b = x;
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  // EntityAwareProtocolAdapter implementation

  async discoverEntities(deviceId: string): Promise<ProtocolEntity[]> {
    if (this.testMode) {
      return this.discoverEntitiesTestMode(deviceId);
    }

    const connection = this.bridges.get(deviceId);
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
    const connection = this.bridges.get(deviceId);
    if (!connection) {
      return [];
    }

    // Convert test lights to protocol entities
    const entities: ProtocolEntity[] = [];

    for (const [lightId, light] of this.testLights.entries()) {
      const entityMapping = findEntityMapping(
        'hue',
        light.type,
        HUE_ENTITY_MAPPINGS,
      );
      const mapping = entityMapping ||
        HUE_ENTITY_MAPPINGS[0] || {
          capabilities: [{ type: 'on_off' }],
          deviceType: 'light',
          entityKind: EntityKind.Light,
          keyPattern: 'light.{device_name}_{entity_name}',
          protocolType: 'hue',
        };

      const entityKey = generateEntityKey(mapping, 'hue', lightId, light.room);

      const entity: ProtocolEntity = {
        capabilities: mapping.capabilities,
        deviceId: deviceId,
        key: entityKey,
        kind: mapping.entityKind,
        name: light.name,
      };

      entities.push(entity);

      // Store in connection for consistency
      connection.entities.set(entityKey, entity);
      connection.entityToLightId.set(entityKey, lightId);
      connection.lights.set(lightId, light);
    }

    log(`Discovered ${entities.length} test entities for bridge: ${deviceId}`);
    return entities;
  }

  subscribeEntityState(
    entityId: string,
    callback: (state: StateUpdate) => void,
  ): void {
    // Find the connection that has this entity
    for (const connection of this.bridges.values()) {
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
    for (const connection of this.bridges.values()) {
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
      for (const connection of this.bridges.values()) {
        if (connection.entities.has(entityId)) {
          const entity = connection.entities.get(entityId);
          if (!entity) continue;

          // Find the corresponding Hue light
          const hueLightId = connection.entityToLightId.get(entityId);
          if (!hueLightId) continue;
          const light = connection.lights.get(hueLightId);
          if (!light) continue;

          // Map capability to Hue command
          const command = this.mapCapabilityToHueCommand(capability, value);
          if (command) {
            await connection.client.setLightState(hueLightId, command);
            log(`Sent command to entity ${entityId}: ${capability} = ${value}`);
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      log(`Failed to send command to entity ${entityId}:`, error);
      return false;
    }
  }

  /**
   * Map capability to Hue command
   */
  private mapCapabilityToHueCommand(
    capability: string,
    value: unknown,
  ): Record<string, unknown> | null {
    switch (capability) {
      case 'on_off':
        return { on: Boolean(value) };
      case 'brightness':
        return { bri: Math.round((Number(value || 0) / 100) * 254) };
      case 'color_temp':
        return { ct: Number(value || 0) };
      case 'color_rgb':
        if (Array.isArray(value) && value.length === 3) {
          const r = Number(value[0]) || 0;
          const g = Number(value[1]) || 0;
          const b = Number(value[2]) || 0;
          const { hue, sat } = this.rgbToHueSat(r, g, b);
          return { hue: Math.round(hue * 182.04), sat: Math.round(sat * 254) };
        }
        return null;
      default:
        return null;
    }
  }

  /**
   * Convert RGB to Hue hue/sat
   */
  private rgbToHueSat(
    r: number,
    g: number,
    b: number,
  ): { hue: number; sat: number } {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let hue = 0;
    if (delta !== 0) {
      if (max === r) {
        hue = ((g - b) / delta) % 6;
      } else if (max === g) {
        hue = (b - r) / delta + 2;
      } else {
        hue = (r - g) / delta + 4;
      }
    }

    hue = (hue * 60 + 360) % 360;
    const sat = max === 0 ? 0 : delta / max;

    return { hue, sat };
  }

  // ProtocolAdapter interface methods

  async connect(): Promise<void> {
    // No-op for global connection
  }

  async disconnect(): Promise<void> {
    await this.shutdown();
  }

  isConnected(): boolean {
    return this.initialized && this.bridges.size > 0;
  }

  /**
   * Reconnect to existing Hue devices
   */
  async reconnectDevices(devices: Device[]): Promise<void> {
    log(`Reconnecting ${devices.length} Hue devices`);

    for (const device of devices) {
      // Skip devices that don't have IP address or aren't Hue devices
      if (!device.ipAddress || device.protocol !== 'hue') {
        continue;
      }

      // Skip devices that are already connected
      if (this.bridges.has(device.id)) {
        log(`Device ${device.name} already connected, skipping`);
        continue;
      }

      try {
        await this.connectDevice(device);
        log(`Reconnected Hue device: ${device.name} at ${device.ipAddress}`);
      } catch (error) {
        log(`Failed to reconnect Hue device ${device.name}:`, error);
      }
    }

    log('Finished reconnecting Hue devices');
  }
}

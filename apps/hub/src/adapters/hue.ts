/**
 * Philips Hue Protocol Adapter
 * Wraps @cove/protocols/hue for hub daemon integration
 */

import { debug } from '@cove/logger';
import { HueClient } from '@cove/protocols/hue';
import type {
  Device,
  DeviceCapability,
  DeviceCommand,
  DeviceType,
  ProtocolAdapter,
  ProtocolType,
} from '@cove/types';
import {
  DeviceCapability as Capability,
  DeviceType as Type,
} from '@cove/types';
import type { StateManager } from '../state-manager';

const log = debug('cove:hub:adapter:hue');

interface HueBridgeConnection {
  client: HueClient;
  bridgeId: string;
  ipAddress: string;
  authenticated: boolean;
  username?: string;
  devices: Map<string, Device>; // Map of Hue light IDs to Cove devices
}

export class HueAdapter implements ProtocolAdapter {
  readonly name = 'Hue Adapter';
  readonly protocol: ProtocolType = 'hue' as ProtocolType;

  private bridges: Map<string, HueBridgeConnection> = new Map();
  private initialized = false;
  private stateManager: StateManager | null = null;

  constructor(stateManager?: StateManager | null) {
    this.stateManager = stateManager || null;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      log('Already initialized');
      return;
    }

    log('Initializing Hue adapter');
    this.initialized = true;
    log('Hue adapter initialized');
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
  async connect(device: Device): Promise<void> {
    if (!device.ipAddress) {
      throw new Error('Hue bridge requires IP address');
    }

    if (!device.id) {
      throw new Error('Device must have an ID to connect');
    }

    const bridgeId = device.id;
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
      username: device.config.api_key as string | undefined,
    });

    // Store connection info (not yet authenticated)
    const connection: HueBridgeConnection = {
      authenticated: false,
      bridgeId,
      client,
      devices: new Map(),
      ipAddress: device.ipAddress,
      username: device.config.api_key as string | undefined,
    };

    this.bridges.set(bridgeId, connection);

    // If we have a username, try to connect
    if (connection.username) {
      try {
        await client.connect();
        connection.authenticated = true;
        log(`Successfully connected to bridge: ${bridgeId}`);

        // Discover lights on this bridge
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
   * Discover and register all lights on a bridge
   */
  private async discoverLights(connection: HueBridgeConnection): Promise<void> {
    try {
      const lights = await connection.client.getLights();
      log(
        `Discovered ${Object.keys(lights).length} lights on bridge ${connection.bridgeId}`,
        lights,
      );

      for (const [lightId, light] of Object.entries(lights)) {
        // Map Hue light to Cove device
        const capabilities: DeviceCapability[] = [Capability.OnOff];

        // Add capabilities based on light type
        if (light.state.bri !== undefined) {
          capabilities.push(Capability.Brightness);
        }
        if (light.state.hue !== undefined && light.state.sat !== undefined) {
          capabilities.push(Capability.ColorRgb);
        }
        if (light.state.ct !== undefined) {
          capabilities.push(Capability.ColorTemperature);
        }

        // Use Hue's uniqueid for external ID if available, otherwise fallback to bridgeId_light_lightId
        const externalId = light.uniqueid
          ? `hue_${light.uniqueid.replace(/[^a-zA-Z0-9]/g, '_')}`
          : `hue_bridge_${connection.bridgeId}_light_${lightId}`;

        const device: Device = {
          available: light.state.reachable || true,
          capabilities,
          config: {
            bridgeId: connection.bridgeId,
            hueLightId: lightId,
            manufacturer: light.manufacturername,
            model: light.modelid,
            nativeType: light.type, // Store Hue's original type
            productName: light.productname,
            swVersion: light.swversion,
            uniqueId: light.uniqueid,
          },
          createdAt: new Date(),
          deviceType: Type.Light as DeviceType,
          externalId, // Stable external ID for deduplication
          hubId: connection.bridgeId,
          ipAddress: connection.ipAddress,

          // Top-level metadata fields (searchable/indexable)
          manufacturer: light.manufacturername,
          model: light.productname || light.modelid, // Use product name if available, fallback to model ID

          name: light.name,
          online: light.state.reachable || true,
          orgId: undefined,
          protocol: this.protocol,
          state: {
            brightness: light.state.bri
              ? Math.round((light.state.bri / 254) * 100)
              : undefined,
            color_temp: light.state.ct,
            on: light.state.on,
          },
          updatedAt: new Date(),
          userId: '', // Will be set by daemon
        };

        connection.devices.set(lightId, device);
      }
    } catch (error) {
      log(`Failed to discover lights on bridge ${connection.bridgeId}:`, error);
    }
  }

  /**
   * Get all discovered lights for a bridge
   */
  async getDevices(bridgeId: string): Promise<Device[]> {
    const connection = this.bridges.get(bridgeId);
    if (!connection) {
      return [];
    }

    return Array.from(connection.devices.values());
  }

  /**
   * Disconnect from a Hue bridge
   */
  async disconnect(device: Device): Promise<void> {
    if (!device.id) {
      log('Device has no ID, cannot disconnect');
      return;
    }

    const bridgeId = device.id;
    const connection = this.bridges.get(bridgeId);

    if (!connection) {
      log(`Bridge ${bridgeId} not connected`);
      return;
    }

    log(`Disconnecting from bridge: ${bridgeId}`);

    try {
      await connection.client.disconnect();
    } catch (error) {
      log(`Error disconnecting from bridge ${bridgeId}:`, error);
    }

    this.bridges.delete(bridgeId);
    log(`Disconnected from bridge: ${bridgeId}`);
  }

  /**
   * Send a command to a Hue light
   */
  async sendCommand(device: Device, command: DeviceCommand): Promise<void> {
    const bridgeId = device.config.bridgeId as string;
    const lightId = device.config.hueLightId as string;

    const connection = this.bridges.get(bridgeId);
    if (!connection || !connection.authenticated) {
      throw new Error(`Bridge ${bridgeId} not connected or not authenticated`);
    }

    log(
      `Sending command to light ${lightId}: ${command.capability} =`,
      command.value,
    );

    switch (command.capability) {
      case Capability.OnOff: {
        await connection.client.toggleLight(lightId, command.value as boolean);
        break;
      }

      case Capability.Brightness: {
        // Convert 0-100 to 0-254
        const bri = Math.round(((command.value as number) / 100) * 254);
        await connection.client.setBrightness(lightId, bri);
        break;
      }

      case Capability.ColorRgb: {
        // TODO: Convert RGB to Hue's hue/sat or xy format
        log('RGB color control not yet implemented');
        break;
      }

      case Capability.ColorTemperature: {
        // Assuming value is in mireds
        await connection.client.setColorTemperature(
          lightId,
          command.value as number,
        );
        break;
      }

      default: {
        log(`Unsupported command capability: ${command.capability}`);
      }
    }
  }

  /**
   * Poll state for Hue lights (optional, as Hue doesn't push state changes)
   */
  async pollState(device: Device): Promise<void> {
    const bridgeId = device.config.bridgeId as string;
    const lightId = device.config.hueLightId as string;

    const connection = this.bridges.get(bridgeId);
    if (!connection || !connection.authenticated) {
      return;
    }

    try {
      const light = await connection.client.getLight(lightId);

      // Update device state
      const bri = light.state.bri
        ? Math.round((light.state.bri / 254) * 100)
        : undefined;
      device.state = {
        brightness: bri,
        color_temp: light.state.ct,
        on: light.state.on,
      };
      device.online = light.state.reachable || true;
      device.available = light.state.reachable || true;
      device.updatedAt = new Date();

      // Use StateManager for intelligent persistence
      if (this.stateManager && device.id) {
        // Update on/off state
        await this.stateManager.updateState({
          deviceId: device.id,
          entityName: device.name,
          source: 'hue',
          stateKey: 'on',
          value: light.state.on,
        });

        // Update brightness if available
        if (bri !== undefined) {
          await this.stateManager.updateState({
            deviceId: device.id,
            entityName: `${device.name} Brightness`,
            source: 'hue',
            stateKey: 'brightness',
            value: bri,
          });
        }

        // Update color temp if available
        if (light.state.ct !== undefined) {
          await this.stateManager.updateState({
            deviceId: device.id,
            entityName: `${device.name} Color Temperature`,
            source: 'hue',
            stateKey: 'color_temp',
            value: light.state.ct,
          });
        }
      }
    } catch (error) {
      log(`Failed to poll state for light ${lightId}:`, error);
    }
  }
}

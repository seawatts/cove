/**
 * Device Lifecycle Manager
 * Handles device discovery, connection, entity discovery, and state management
 */

import type { Device } from '@cove/db';
import type { DiscoveryManager } from '@cove/discovery';
import { debug } from '@cove/logger';
import type { DeviceDiscovery, ProtocolType } from '@cove/types';
import { HubEventType } from '@cove/types';
import type { AdapterRegistry } from './adapters/registry';
import type { HubDatabase } from './db';
import type { DeviceEventCollector } from './events';
import type { StateManager } from './state-manager';

const log = debug('cove:hub:device-lifecycle');

export interface DeviceLifecycleOptions {
  db?: HubDatabase | null;
  stateManager?: StateManager | null;
  eventCollector?: DeviceEventCollector | null;
  adapterRegistry?: AdapterRegistry;
  discoveryManager?: DiscoveryManager;
}

export class DeviceLifecycleManager {
  private db: HubDatabase | null;
  private stateManager: StateManager | null;
  private eventCollector: DeviceEventCollector | null;
  private adapterRegistry: AdapterRegistry | null;
  private discoveryManager: DiscoveryManager | null;
  private homeId: string | null = null;

  constructor(options: DeviceLifecycleOptions = {}) {
    this.db = options.db || null;
    this.stateManager = options.stateManager || null;
    this.eventCollector = options.eventCollector || null;
    this.adapterRegistry = options.adapterRegistry || null;
    this.discoveryManager = options.discoveryManager || null;
    log('Device lifecycle manager initialized');
  }

  /**
   * Set the home ID for device operations
   */
  setHomeId(homeId: string): void {
    this.homeId = homeId;
    log(`Set home ID: ${homeId}`);
  }

  /**
   * Setup discovery event handlers
   */
  setupDiscoveryHandlers(): void {
    if (!this.discoveryManager) {
      log('No discovery manager available');
      return;
    }

    this.discoveryManager.onDeviceDiscovered = (discovery) => {
      this.handleDeviceDiscovered(discovery);
    };

    this.discoveryManager.onDeviceLost = (deviceId) => {
      this.handleDeviceLost(deviceId);
    };

    log('Discovery event handlers setup');
  }

  /**
   * Handle device discovery - updated for entity-first architecture
   */
  private async handleDeviceDiscovered(
    discovery: DeviceDiscovery,
  ): Promise<void> {
    log(`Device discovered: ${discovery.name} (${discovery.protocol})`);

    try {
      // Create device record in database
      if (this.db && this.homeId) {
        const device = await this.db.insertDevice({
          externalId: discovery.macAddress || discovery.ipAddress,
          homeId: this.homeId,
          hostname: discovery.metadata.hostname as string,
          hwVersion: discovery.metadata.hardwareVersion as string,
          ipAddress: discovery.ipAddress,
          macAddress: discovery.macAddress,
          manufacturer:
            (discovery.metadata.manufacturer as string) || 'Unknown',
          metadata: discovery.metadata,
          model: (discovery.metadata.model as string) || 'Unknown',
          name: discovery.name,
          port: discovery.metadata.port as number,
          protocol: discovery.protocol,
          swVersion: discovery.metadata.firmwareVersion as string,
          type: discovery.deviceType,
        });

        if (!device) {
          log(`Failed to insert device ${discovery.name} into database`);
          return;
        }

        log(`Device ${discovery.name} inserted into database`);

        // Connect to device using appropriate adapter
        const adapter = this.adapterRegistry?.get(discovery.protocol);
        if (adapter?.connectDevice) {
          try {
            await adapter.connectDevice(device);
            log(`Connected to device: ${discovery.name}`);

            // If adapter supports entity discovery, discover entities
            const entityAwareAdapter = this.adapterRegistry?.getEntityAware(
              discovery.protocol,
            );
            if (entityAwareAdapter) {
              const entities = await entityAwareAdapter.discoverEntities(
                device.id,
              );
              log(
                `Discovered ${entities.length} entities for device: ${discovery.name}`,
              );

              // Subscribe to entity state changes
              for (const entity of entities) {
                entityAwareAdapter.subscribeEntityState(
                  entity.key,
                  (stateUpdate) => {
                    this.handleEntityStateUpdate(stateUpdate);
                  },
                );
              }
            }

            this.eventCollector?.emit({
              eventType: HubEventType.DeviceDiscovered,
              message: `Device discovered and connected: ${discovery.name}`,
              metadata: {
                deviceType: discovery.deviceType,
                ipAddress: discovery.ipAddress,
                protocol: discovery.protocol,
              },
            });
          } catch (error) {
            log(`Failed to connect to device ${discovery.name}:`, error);
            this.eventCollector?.emit({
              eventType: HubEventType.DeviceDisconnected,
              message: `Failed to connect to device: ${discovery.name}`,
              metadata: { error: String(error) },
            });
          }
        }
      }
    } catch (error) {
      log(`Error handling device discovery for ${discovery.name}:`, error);
    }
  }

  /**
   * Handle device lost
   */
  private async handleDeviceLost(deviceId: string): Promise<void> {
    log(`Device lost: ${deviceId}`);

    try {
      // Clear entity state cache for all entities of this device
      if (this.stateManager && this.db) {
        const entities = await this.db.getEntitiesForDevice(deviceId);
        if (entities) {
          for (const entity of entities) {
            this.stateManager.clearEntityState(entity.id);
          }
        }
      }

      this.eventCollector?.emit({
        eventType: HubEventType.DeviceLost,
        message: `Device lost: ${deviceId}`,
      });
    } catch (error) {
      log(`Error handling device lost for ${deviceId}:`, error);
    }
  }

  /**
   * Handle entity state update
   */
  private handleEntityStateUpdate(stateUpdate: {
    entityId: string;
    state: string;
    attrs?: Record<string, unknown>;
    timestamp?: Date;
  }): void {
    log(`Entity state update: ${stateUpdate.entityId} = ${stateUpdate.state}`);

    if (this.stateManager) {
      this.stateManager.updateState(stateUpdate);
    }

    this.eventCollector?.emit({
      eventType: HubEventType.StateChanged,
      message: `Entity state changed: ${stateUpdate.entityId}`,
      metadata: {
        attrs: stateUpdate.attrs,
        entityId: stateUpdate.entityId,
        state: stateUpdate.state,
      },
    });
  }

  /**
   * Reconnect to existing devices in the database
   */
  async reconnectExistingDevices(): Promise<void> {
    if (!this.db || !this.homeId || !this.adapterRegistry) {
      log(
        'No database, home ID, or adapter registry available for reconnecting devices',
      );
      return;
    }

    try {
      log('Reconnecting existing devices...');

      // Get all devices for this home
      const devices = await this.db.getDevicesByHomeId(this.homeId);

      // Group devices by protocol for efficient reconnection
      const devicesByProtocol = new Map<ProtocolType, Device[]>();
      for (const device of devices) {
        const protocol = device.protocol as ProtocolType;
        if (!devicesByProtocol.has(protocol)) {
          devicesByProtocol.set(protocol, []);
        }
        devicesByProtocol.get(protocol)?.push(device);
      }

      // Reconnect devices using their respective adapters
      for (const [protocol, protocolDevices] of devicesByProtocol.entries()) {
        const adapter = this.adapterRegistry.getEntityAware(protocol);
        if (adapter && 'reconnectDevices' in adapter) {
          try {
            await (
              adapter as {
                reconnectDevices: (devices: Device[]) => Promise<void>;
              }
            ).reconnectDevices(protocolDevices);
            log(`Reconnected ${protocolDevices.length} ${protocol} devices`);
          } catch (error) {
            log(`Failed to reconnect ${protocol} devices:`, error);
          }
        }
      }

      log('Finished reconnecting existing devices');
    } catch (error) {
      log('Error reconnecting existing devices:', error);
    }
  }

  /**
   * Send entity command
   */
  async sendEntityCommand(command: {
    entityId: string;
    capability: string;
    value: unknown;
    userId?: string;
  }): Promise<boolean> {
    const log = debug('cove:hub:device-lifecycle:send-command');
    log(
      `Sending command: ${command.entityId} ${command.capability} = ${command.value}`,
    );

    try {
      if (!this.db) {
        log('No database available for command execution');
        return false;
      }

      // Get entity info to find its device and protocol
      const entityWithDevice = await this.db.getEntityWithDevice(
        command.entityId,
      );
      if (!entityWithDevice) {
        log(`Entity not found: ${command.entityId}`);
        return false;
      }

      const protocol = entityWithDevice.device.protocol as ProtocolType;

      // Get the entity-aware adapter
      const adapter = this.adapterRegistry?.getEntityAware(protocol);
      if (!adapter) {
        log(`No entity-aware adapter found for protocol: ${protocol}`);
        return false;
      }

      // Send the command
      const success = await adapter.sendEntityCommand(
        command.entityId,
        command.capability,
        command.value,
      );

      log(`Command result: ${success ? 'success' : 'failed'}`);
      return success;
    } catch (error) {
      log('Error sending command:', error);
      return false;
    }
  }

  /**
   * Get discovered devices
   */
  getDiscoveredDevices(): DeviceDiscovery[] {
    return this.discoveryManager?.getDiscoveredDevices() || [];
  }

  /**
   * Get device lifecycle statistics
   */
  getStats(): {
    homeId: string | null;
    hasDatabase: boolean;
    hasStateManager: boolean;
    hasEventCollector: boolean;
    hasAdapterRegistry: boolean;
    hasDiscoveryManager: boolean;
    adapterCount: number;
  } {
    return {
      adapterCount: this.adapterRegistry?.getAdapterCount() || 0,
      hasAdapterRegistry: this.adapterRegistry !== null,
      hasDatabase: this.db !== null,
      hasDiscoveryManager: this.discoveryManager !== null,
      hasEventCollector: this.eventCollector !== null,
      hasStateManager: this.stateManager !== null,
      homeId: this.homeId,
    };
  }
}

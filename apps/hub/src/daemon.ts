/**
 * Core Hub Daemon
 * Updated for Home Assistant++ entity-first architecture
 * Orchestrates discovery, device management, entity discovery, and telemetry
 */

import { DiscoveryManager } from '@cove/discovery';
import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import type {
  EntityAwareProtocolAdapter,
  ProtocolAdapter,
} from '@cove/protocols';
import { type DeviceDiscovery, HubEventType, ProtocolType } from '@cove/types';
import { ESPHomeAdapter, HueAdapter } from './adapters';
import { CommandProcessor } from './command-processor';
import { HubDatabase } from './db';
import { env } from './env';
import { DeviceEventCollector } from './events';
import { getSystemInfo } from './health';
import { DeviceMetricsCollector } from './metrics';
import { StateManager } from './state-manager';

const log = debug('cove:daemon');

export class HubDaemon {
  private discoveryManager: DiscoveryManager;
  private db: HubDatabase | null = null;
  private stateManager: StateManager | null = null;
  private protocolAdapters: Map<ProtocolType, ProtocolAdapter> = new Map();
  private entityAwareAdapters: Map<ProtocolType, EntityAwareProtocolAdapter> =
    new Map();
  private commandProcessor: CommandProcessor | null = null;
  private running = false;
  private hubId: string;
  private hubDeviceId: string | null = null; // Hub's device ID in device table
  private homeId: string | null = null; // Home ID for entity management
  private eventCollector: DeviceEventCollector | null = null;
  private metricsCollector: DeviceMetricsCollector | null = null;

  constructor(hubId?: string) {
    log('Initializing hub daemon');

    // Generate or use provided hub ID
    this.hubId = hubId || env.HUB_ID || createId({ prefix: 'hub' });

    this.discoveryManager = new DiscoveryManager();

    // Initialize database layer
    try {
      this.db = new HubDatabase();
      log('Database layer initialized');

      // Initialize StateManager with database
      this.stateManager = new StateManager(this.db);
      log('StateManager initialized');
    } catch (error) {
      log('Failed to initialize database layer:', error);
      log('Running in local-only mode');
    }

    // Wire up discovery events
    this.discoveryManager.onDeviceDiscovered = (discovery) => {
      this.handleDeviceDiscovered(discovery);
    };

    this.discoveryManager.onDeviceLost = (deviceId) => {
      this.handleDeviceLost(deviceId);
    };

    // Initialize protocol adapters
    this.initializeAdapters();

    log(`Hub daemon initialized with ID: ${this.hubId}`);
  }

  private initializeAdapters(): void {
    log('Initializing protocol adapters');

    try {
      // Register ESPHome adapter with StateManager and database
      const esphomeAdapter = new ESPHomeAdapter(this.stateManager, this.db);
      this.protocolAdapters.set(ProtocolType.ESPHome, esphomeAdapter);
      this.entityAwareAdapters.set(ProtocolType.ESPHome, esphomeAdapter);
      log('Registered ESPHome adapter');

      // Register Hue adapter with StateManager and database
      const hueAdapter = new HueAdapter(this.stateManager, this.db);
      this.protocolAdapters.set(ProtocolType.Hue, hueAdapter);
      this.entityAwareAdapters.set(ProtocolType.Hue, hueAdapter);
      log('Registered Hue adapter');

      // TODO: Register other adapters (Matter, Zigbee, etc.)

      // Note: Command processor will be initialized in start() after event collector is ready
    } catch (error) {
      log('Failed to initialize adapters:', error);
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      log('Daemon already running');
      return;
    }

    log('Starting hub daemon');

    // Create or get home if database is enabled
    if (this.db) {
      // For now, create a default home or get the first one
      // In a real implementation, this would be based on user authentication
      this.homeId = await this.db.registerHome(
        env.HUB_NAME || 'Cove Home',
        'America/Los_Angeles',
      );

      if (this.homeId) {
        log(`Using home: ${this.homeId}`);
      }
    }

    // Register hub as a device if database is enabled
    if (this.db && this.homeId) {
      const systemInfo = getSystemInfo();

      const hubDevice = await this.db.registerHubAsDevice({
        homeId: this.homeId,
        ipAddress: systemInfo.ipAddress,
        manufacturer: 'Cove',
        metadata: {
          // Hub-specific configuration
          autoUpdate: true,
          discoveryEnabled: env.DISCOVERY_ENABLED,
          discoveryInterval: env.DISCOVERY_INTERVAL || 300,
          enabledProtocols: ['hue', 'sonos', 'esphome'], // Supported protocols
          telemetryInterval: env.TELEMETRY_INTERVAL || 30,
          updateChannel: 'stable',
          // System info
          ...systemInfo,
          apiPort: env.PORT || 3100,
        },
        model: 'Cove Hub',
        name: env.HUB_NAME || 'Cove Hub',
      });

      if (hubDevice?.id) {
        this.hubDeviceId = hubDevice.id;
        log(`Hub registered as device: ${this.hubDeviceId}`);
      }
    }

    // Initialize event and metrics collectors after we have hub device ID
    if (this.hubDeviceId) {
      this.eventCollector = new DeviceEventCollector({
        db: this.db,
        deviceId: this.hubDeviceId,
      });

      this.metricsCollector = new DeviceMetricsCollector({
        db: this.db,
        deviceId: this.hubDeviceId,
      });

      // Start collectors
      this.eventCollector.start();
      this.metricsCollector.start();

      // Initialize command processor now that we have event collector
      // (only if database is configured)
      if (this.db) {
        this.commandProcessor = new CommandProcessor(this.protocolAdapters, {
          db: this.db,
          entityAwareAdapters: this.entityAwareAdapters,
          eventCollector: this.eventCollector,
        });
        log(
          'Command processor initialized with event collector and entity-aware adapters',
        );
      }
    }

    // Initialize all protocol adapters
    for (const [protocol, adapter] of this.protocolAdapters.entries()) {
      try {
        await adapter.initialize();
        log(`Initialized ${protocol} adapter`);

        this.eventCollector?.emit({
          eventType: HubEventType.AdapterInitialized,
          message: `${protocol} adapter initialized successfully`,
        });
      } catch (error) {
        log(`Failed to initialize ${protocol} adapter:`, error);
        this.eventCollector?.emit({
          eventType: HubEventType.AdapterError,
          message: `Failed to initialize ${protocol} adapter: ${error}`,
        });
      }
    }

    // Start discovery
    try {
      await this.discoveryManager.start();
      log('Discovery manager started');

      this.eventCollector?.emit({
        eventType: HubEventType.HubStarted,
        message: 'Hub daemon started successfully',
      });
    } catch (error) {
      log('Failed to start discovery manager:', error);
      this.eventCollector?.emit({
        eventType: HubEventType.SystemError,
        message: `Failed to start discovery manager: ${error}`,
      });
    }

    this.running = true;
    log('Hub daemon started successfully');
  }

  async stop(): Promise<void> {
    if (!this.running) {
      log('Daemon not running');
      return;
    }

    log('Stopping hub daemon');

    // Stop discovery
    try {
      await this.discoveryManager.stop();
      log('Discovery manager stopped');
    } catch (error) {
      log('Error stopping discovery manager:', error);
    }

    // Stop all protocol adapters
    for (const [protocol, adapter] of this.protocolAdapters.entries()) {
      try {
        await adapter.shutdown();
        log(`Stopped ${protocol} adapter`);

        this.eventCollector?.emit({
          eventType: HubEventType.AdapterShutdown,
          message: `${protocol} adapter shut down`,
        });
      } catch (error) {
        log(`Error stopping ${protocol} adapter:`, error);
      }
    }

    // Stop collectors
    if (this.metricsCollector) {
      this.metricsCollector.stop();
      log('Metrics collector stopped');
    }

    if (this.eventCollector) {
      this.eventCollector.stop();
      log('Event collector stopped');
    }

    this.eventCollector?.emit({
      eventType: HubEventType.HubStopped,
      message: 'Hub daemon stopped',
    });

    this.running = false;
    log('Hub daemon stopped');
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
          homeId: this.homeId,
          ipAddress: discovery.ipAddress,
          manufacturer:
            (discovery.metadata.manufacturer as string) || 'Unknown',
          metadata: discovery.metadata,
          model: (discovery.metadata.model as string) || 'Unknown',
          name: discovery.name,
        });

        if (!device) {
          log(`Failed to insert device ${discovery.name} into database`);
          return;
        }

        log(`Device ${discovery.name} inserted into database`);

        // Connect to device using appropriate adapter
        const adapter = this.protocolAdapters.get(discovery.protocol);
        if (adapter?.connectDevice) {
          try {
            await adapter.connectDevice(device);
            log(`Connected to device: ${discovery.name}`);

            // If adapter supports entity discovery, discover entities
            const entityAwareAdapter = this.entityAwareAdapters.get(
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
        // Get entities for this device and clear their state
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
   * Get daemon status
   */
  getStatus(): {
    running: boolean;
    hubId: string;
    hubDeviceId: string | null;
    homeId: string | null;
    adapters: string[];
    discoveryActive: boolean;
    databaseConnected: boolean;
  } {
    return {
      adapters: Array.from(this.protocolAdapters.keys()),
      databaseConnected: this.db !== null,
      discoveryActive: this.discoveryManager.isActive(),
      homeId: this.homeId,
      hubDeviceId: this.hubDeviceId,
      hubId: this.hubId,
      running: this.running,
    };
  }

  /**
   * Get state manager statistics
   */
  getStateManagerStats(): Record<string, unknown> | null {
    return this.stateManager?.getStats() || null;
  }

  /**
   * Get protocol adapter
   */
  getAdapter(protocol: ProtocolType): ProtocolAdapter | undefined {
    return this.protocolAdapters.get(protocol);
  }

  /**
   * Get all protocol adapters
   */
  getAdapters(): Map<ProtocolType, ProtocolAdapter> {
    return this.protocolAdapters;
  }

  /**
   * Check if daemon is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get discovered devices
   */
  getDiscoveredDevices(): DeviceDiscovery[] {
    return this.discoveryManager.getDiscoveredDevices();
  }

  /**
   * Get event collector
   */
  getEventCollector(): DeviceEventCollector | null {
    return this.eventCollector;
  }

  /**
   * Get metrics collector
   */
  getMetricsCollector(): DeviceMetricsCollector | null {
    return this.metricsCollector;
  }

  /**
   * Get hub ID
   */
  getHubId(): string {
    return this.hubId;
  }

  /**
   * Get command processor
   */
  getCommandProcessor(): CommandProcessor | null {
    return this.commandProcessor;
  }

  /**
   * Get entity-aware protocol adapter
   */
  getEntityAwareAdapter(
    protocol: ProtocolType,
  ): EntityAwareProtocolAdapter | undefined {
    return this.entityAwareAdapters.get(protocol);
  }
}

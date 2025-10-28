/**
 * Hub Daemon V2 - Main orchestration following ha-pro.md patterns
 * Manages discovery, subscriptions, state writing, and telemetry batching
 */

import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import { CommandRouter } from './core/command-router';
import {
  type Driver,
  type DriverRegistry,
  SimpleDriverRegistry,
} from './core/driver-kit';
import { DriverLoader } from './core/driver-loader';
import { EventBus } from './core/event-bus';
import { Registry } from './core/registry';
import { StateStore } from './core/state-store';
import { type DatabaseClient, DatabaseWrapper } from './db';
import { env } from './env';

const log = debug('cove:hub-v2:daemon');

export interface HubDaemonOptions {
  dbPath?: string;
  hubId?: string;
}

/**
 * Hub V2 Daemon - Main orchestration class
 */
export class HubDaemon {
  private dbPath: string;
  private hubId: string;

  // Core components
  private db: DatabaseClient | null = null;
  private eventBus: EventBus | null = null;
  private registry: Registry | null = null;
  private stateStore: StateStore | null = null;
  private commandRouter: CommandRouter | null = null;
  private driverRegistry: DriverRegistry | null = null;

  // Worker loops
  private discoveryInterval: ReturnType<typeof setInterval> | null = null;
  private subscriptionInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  // Subscription tracking
  private activeSubscriptions = new Map<string, () => void>();

  constructor(options: HubDaemonOptions = {}) {
    this.dbPath = options.dbPath || env.DB_PATH;
    this.hubId = options.hubId || env.HUB_ID || createId({ prefix: 'hub' });
  }

  /**
   * Initialize all components
   */
  async initialize() {
    log('Initializing Hub V2 daemon');
    log(`Hub ID: ${this.hubId}`);
    log(`Database: ${this.dbPath}`);

    try {
      // Initialize database
      const dbWrapper = new DatabaseWrapper(this.dbPath);
      await dbWrapper.initialize();
      this.db = dbWrapper.getClient();
      log('Database initialized');

      // Initialize core components
      this.eventBus = new EventBus();
      this.registry = new Registry({ db: this.db });
      this.stateStore = new StateStore({
        db: this.db,
        eventBus: this.eventBus,
      });

      // Initialize driver registry
      this.driverRegistry = new SimpleDriverRegistry();

      // Auto-load all drivers
      await DriverLoader.loadDrivers(this.driverRegistry);
      log('All drivers loaded and initialized');

      // Initialize command router
      const driverMap = new Map<string, Driver>();
      for (const protocol of this.driverRegistry.getProtocols()) {
        const driver = this.driverRegistry.get(protocol);
        if (driver) {
          driverMap.set(protocol, driver);
        }
      }

      this.commandRouter = new CommandRouter({
        drivers: driverMap,
        eventBus: this.eventBus,
        registry: this.registry,
      });

      // Set up event handlers
      this.setupEventHandlers();

      log('Hub V2 daemon initialized');
    } catch (error) {
      log('Failed to initialize daemon:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers() {
    if (!this.eventBus || !this.stateStore) return;

    // Handle state changes
    this.eventBus.subscribe('entity/*/state', (event: unknown) => {
      if (
        typeof event === 'object' &&
        event !== null &&
        'entityId' in event &&
        'state' in event
      ) {
        const stateEvent = event as { entityId: string; state: unknown };
        this.stateStore
          ?.writeEntityState(
            stateEvent.entityId,
            stateEvent.state as Record<string, unknown>,
          )
          .catch((error) => {
            log('Failed to write entity state:', error);
          });
      }
    });

    // Handle telemetry
    this.eventBus.subscribe('telemetry', (event: unknown) => {
      if (
        typeof event === 'object' &&
        event !== null &&
        'entityId' in event &&
        'field' in event &&
        'value' in event
      ) {
        const telemetryEvent = event as {
          entityId: string;
          field: string;
          value: unknown;
          unit?: string;
        };
        // Get homeId from registry
        this.registry
          ?.getEntity(telemetryEvent.entityId)
          .then((entity) => {
            if (entity) {
              this.stateStore?.appendTelemetry(
                telemetryEvent.entityId,
                entity.homeId,
                telemetryEvent.field,
                telemetryEvent.value as string | number | boolean,
                telemetryEvent.unit,
              );
            }
          })
          .catch((error: unknown) => {
            log('Failed to append telemetry:', error);
          });
      }
    });

    log('Event handlers set up');
  }

  /**
   * Start the daemon
   */
  async start() {
    if (this.running) {
      log('Daemon already running');
      return;
    }

    log('Starting Hub V2 daemon');

    try {
      // Initialize if not already done
      if (!this.db) {
        await this.initialize();
      }

      // Create default home
      await this.registry?.getOrCreateHome('Default Home');

      // Start telemetry batching
      this.stateStore?.startTelemetryBatching();

      // Start command coalescing
      this.commandRouter?.startCoalescing();

      // Start worker loops
      this.startDiscoveryLoop();
      this.startSubscriptionLoop();
      this.startStateWriterLoop();

      this.running = true;
      log('Hub V2 daemon started');
    } catch (error) {
      log('Failed to start daemon:', error);
      throw error;
    }
  }

  /**
   * Stop the daemon
   */
  async stop() {
    if (!this.running) {
      log('Daemon not running');
      return;
    }

    log('Stopping Hub V2 daemon');

    try {
      // Stop worker loops
      this.stopDiscoveryLoop();
      this.stopSubscriptionLoop();

      // Stop telemetry batching
      if (this.stateStore) {
        this.stateStore.stopTelemetryBatching();
      }

      // Stop command coalescing
      if (this.commandRouter) {
        this.commandRouter.stopCoalescing();
      }

      // Unsubscribe from all entities
      for (const [entityId, unsubscribe] of this.activeSubscriptions) {
        try {
          unsubscribe();
        } catch (error) {
          log(`Error unsubscribing from ${entityId}:`, error);
        }
      }
      this.activeSubscriptions.clear();

      // Shutdown all drivers
      if (this.driverRegistry?.shutdownAll) {
        await this.driverRegistry.shutdownAll();
        log('All drivers shut down');
      }

      this.running = false;
      log('Hub V2 daemon stopped');
    } catch (error) {
      log('Error stopping daemon:', error);
      throw error;
    }
  }

  /**
   * Discovery loop - call driver.discover() for each driver
   */
  private startDiscoveryLoop() {
    if (this.discoveryInterval) return;

    log('Starting discovery loop');

    // Run discovery immediately, then set up interval for subsequent runs
    this.runDiscovery();

    this.discoveryInterval = setInterval(() => {
      this.runDiscovery();
    }, 15000); // Every 15 seconds
  }

  /**
   * Run discovery for all drivers
   */
  private async runDiscovery(): Promise<void> {
    if (!this.driverRegistry || !this.registry) return;

    const drivers = this.driverRegistry.getAll();
    for (const driver of drivers) {
      try {
        const protocols = this.driverRegistry.getProtocols();
        const protocol =
          protocols.find((p) => this.driverRegistry?.get(p) === driver) ||
          'unknown';
        log(`Running discovery for ${protocol} driver`);

        const home = await this.registry.getOrCreateHome('Default Home');

        for await (const deviceDesc of driver.discover()) {
          try {
            // Upsert device
            await this.registry.upsertDevice(deviceDesc, home.id);

            // Auto-connect to discovered devices (ESPHome doesn't require pairing)
            if (deviceDesc.address) {
              try {
                log(
                  `Auto-connecting to ${deviceDesc.id} at ${deviceDesc.address}`,
                );
                await driver.connect(deviceDesc.id, deviceDesc.address);

                // Mark device as paired (ESPHome auto-pairs on connect)
                await this.registry.markDevicePaired(deviceDesc.id);

                // Store empty credentials (ESPHome doesn't need them unless encrypted)
                await this.registry.storeCredentials(
                  deviceDesc.id,
                  'esphome',
                  {},
                );

                // Enumerate entities
                const entities = await driver.getEntities(deviceDesc.id);
                for (const entityDesc of entities) {
                  await this.registry.upsertEntity(
                    entityDesc,
                    deviceDesc.id,
                    home.id,
                  );
                }

                log(
                  `Discovered ${entities.length} entities for ${deviceDesc.id}`,
                );

                // Publish device lifecycle event
                this.eventBus?.publishDeviceLifecycle({
                  details: deviceDesc as unknown as Record<string, unknown>,
                  deviceId: deviceDesc.id,
                  event: 'paired',
                });
              } catch (connectError) {
                log(`Failed to connect to ${deviceDesc.id}:`, connectError);
              }
            }

            // Publish discovery event
            this.eventBus?.publishDeviceLifecycle({
              details: deviceDesc as unknown as Record<string, unknown>,
              deviceId: deviceDesc.id,
              event: 'discovered',
            });
          } catch (error) {
            log(`Error processing discovered device ${deviceDesc.id}:`, error);
          }
        }
      } catch (error) {
        log('Discovery error for driver:', error);
      }
    }
  }

  /**
   * Stop discovery loop
   */
  private stopDiscoveryLoop() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
      log('Stopped discovery loop');
    }
  }

  /**
   * Subscription loop - maintain live connections for all entities
   */
  private startSubscriptionLoop() {
    if (this.subscriptionInterval) return;

    log('Starting subscription loop');

    this.subscriptionInterval = setInterval(async () => {
      if (!this.registry || !this.driverRegistry || !this.eventBus) return;

      try {
        // Get all entities
        const entities = await this.registry.getEntities({});

        for (const entity of entities) {
          // Get device info
          const device = await this.registry.getDevice(entity.deviceId);
          if (!device) continue;

          // Get driver
          const driver = this.driverRegistry.get(device.protocol);
          if (!driver) continue;

          // Check if device is paired
          const credentials = await this.registry.getCredentials(device.id);
          if (!credentials) continue;

          // Skip if already subscribed
          if (this.activeSubscriptions.has(entity.id)) {
            continue;
          }

          try {
            // Subscribe to entity state changes
            const unsubscribe = driver.subscribe(
              entity.id,
              (state: unknown) => {
                const stateObj = state as Record<string, unknown>;

                // Publish state change
                this.eventBus?.publishStateChanged({
                  entityId: entity.id,
                  state: stateObj,
                });

                // For sensor entities, also publish telemetry
                if (entity.kind === 'sensor' && 'value' in stateObj) {
                  // Extract sensor data
                  const value = stateObj.value;
                  const unit = stateObj.unit as string | undefined;

                  // Infer field name from entity name (convert to lowercase, replace spaces with underscores)
                  let field =
                    entity.name?.toLowerCase().replace(/\s+/g, '_') ||
                    'unknown';

                  // For CO2 sensors, standardize the field name
                  if (field.includes('co2') || field.includes('co_2')) {
                    field = 'co2';
                  }

                  // Publish telemetry event
                  this.eventBus?.publishTelemetry({
                    entityId: entity.id,
                    field,
                    unit,
                    value: value as number | string | boolean,
                  });
                }
              },
            );

            // Store unsubscribe function
            this.activeSubscriptions.set(entity.id, unsubscribe);
            log(`Subscribed to entity state: ${entity.id}`);
          } catch (error) {
            log(`Failed to subscribe to entity ${entity.id}:`, error);
          }
        }
      } catch (error) {
        log('Subscription loop error:', error);
      }
    }, 3000); // Every 3 seconds
  }

  /**
   * Stop subscription loop
   */
  private stopSubscriptionLoop() {
    if (this.subscriptionInterval) {
      clearInterval(this.subscriptionInterval);
      this.subscriptionInterval = null;
      log('Stopped subscription loop');
    }
  }

  /**
   * State writer loop - consume state_changed events
   */
  private startStateWriterLoop() {
    // State writing is handled by the event handlers set up in setupEventHandlers()
    log('State writer loop active via event handlers');
  }

  /**
   * Get daemon status
   */
  getStatus() {
    return {
      components: {
        commandRouter: !!this.commandRouter,
        database: !!this.db,
        driverRegistry: !!this.driverRegistry,
        eventBus: !!this.eventBus,
        registry: !!this.registry,
        stateStore: !!this.stateStore,
      },
      drivers: this.driverRegistry?.getProtocols() || [],
      hubId: this.hubId,
      running: this.running,
      workerLoops: {
        discovery: !!this.discoveryInterval,
        subscription: !!this.subscriptionInterval,
      },
    };
  }

  /**
   * Get driver health
   */
  async getDriverHealth() {
    if (!this.driverRegistry) return {};
    return await this.driverRegistry.health();
  }

  /**
   * Process entity command
   */
  async processCommand(command: {
    entityId: string;
    capability: string;
    value: unknown;
    userId?: string;
  }) {
    if (!this.commandRouter) {
      throw new Error('Command router not initialized');
    }

    return await this.commandRouter.processCommand(command);
  }

  /**
   * Get entities with filters
   */
  async getEntities(filters: {
    homeId?: string;
    roomId?: string;
    kind?: string;
    deviceId?: string;
  }) {
    if (!this.registry) {
      throw new Error('Registry not initialized');
    }

    return await this.registry.getEntities(filters);
  }

  /**
   * Get devices by home
   */
  async getDevicesByHome(homeId: string) {
    if (!this.registry) {
      throw new Error('Registry not initialized');
    }

    return await this.registry.getDevicesByHome(homeId);
  }

  /**
   * Get entity telemetry
   */
  async getEntityTelemetry(
    entityId: string,
    options: {
      field?: string;
      since?: Date;
      limit?: number;
    } = {},
  ) {
    if (!this.stateStore) {
      throw new Error('State store not initialized');
    }

    return await this.stateStore.getEntityTelemetry(entityId, options);
  }

  // Accessor methods for internal components
  getEventBus() {
    return this.eventBus;
  }

  getRegistry() {
    return this.registry;
  }

  getDriverRegistry() {
    return this.driverRegistry;
  }

  getCommandRouter() {
    return this.commandRouter;
  }

  getStateStore() {
    return this.stateStore;
  }
}

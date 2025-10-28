/**
 * Core Hub Daemon - Refactored
 * Orchestrates discovery, device management, entity discovery, and telemetry
 * Now uses specialized modules for better testability and maintainability
 */

import type { DiscoveryManager } from '@cove/discovery';
import { DiscoveryManager as DiscoveryManagerImpl } from '@cove/discovery';
import { debug } from '@cove/logger';
import type {
  EntityAwareProtocolAdapter,
  ProtocolAdapter,
} from '@cove/protocols';
import type { DeviceDiscovery, ProtocolType } from '@cove/types';
import { HubEventType } from '@cove/types';
import { AdapterRegistry } from './adapters/registry';
import { CommandProcessor } from './command-processor';
import { HubDatabase } from './db';
import { DeviceLifecycleManager } from './device-lifecycle';
import { env } from './env';
import type { DeviceEventCollector } from './events';
import { getHardwareId } from './health';
import { HubInitializer } from './hub-initializer';
import { LifecycleCoordinator } from './lifecycle-coordinator';
import type { DeviceMetricsCollector } from './metrics';
import { StateManager } from './state-manager';

const log = debug('cove:daemon');

export class HubDaemon {
  private discoveryManager: DiscoveryManager;
  private db: HubDatabase | null = null;
  private stateManager: StateManager | null = null;
  private adapterRegistry: AdapterRegistry | null = null;
  private deviceLifecycleManager: DeviceLifecycleManager | null = null;
  private commandProcessor: CommandProcessor | null = null;
  private hubInitializer: HubInitializer | null = null;
  private lifecycleCoordinator: LifecycleCoordinator | null = null;
  private running = false;
  private hubId: string;
  private testMode: boolean;
  private initializationResult: {
    homeId: string | null;
    hubDeviceId: string | null;
    eventCollector: DeviceEventCollector | null;
    metricsCollector: DeviceMetricsCollector | null;
  } = {
    eventCollector: null,
    homeId: null,
    hubDeviceId: null,
    metricsCollector: null,
  };

  constructor(hubId?: string, testMode = false) {
    try {
      log('Initializing hub daemon');
      log(`Hub ID: ${hubId || env.HUB_ID || getHardwareId()}`);
      log(`Test mode: ${testMode}`);

      // Generate or use provided hub ID, fallback to hardware-based ID
      this.hubId = hubId || env.HUB_ID || getHardwareId();
      this.testMode = testMode;

      // Initialize discovery manager
      log('Initializing discovery manager');
      this.discoveryManager = new DiscoveryManagerImpl();

      // Initialize database layer
      log('Initializing database layer');
      try {
        this.db = new HubDatabase();
        log('Database layer initialized');

        // Initialize StateManager with database
        log('Initializing StateManager');
        this.stateManager = new StateManager(this.db);
        log('StateManager initialized');
      } catch (error) {
        log('Failed to initialize database layer:', error);
        log('Running in local-only mode');
      }

      // Initialize specialized modules
      log('Initializing specialized modules');
      this.initializeModules();

      log(`Hub daemon initialized with ID: ${this.hubId}`);
    } catch (error) {
      log('Error in daemon constructor:', error);
      throw error;
    }
  }

  /**
   * Initialize all specialized modules
   */
  private initializeModules(): void {
    log('Initializing modules');
    log(`Database available: ${!!this.db}`);
    log(`StateManager available: ${!!this.stateManager}`);
    log(`Test mode: ${this.testMode}`);

    // Initialize adapter registry
    this.adapterRegistry = new AdapterRegistry({
      db: this.db,
      stateManager: this.stateManager,
      testMode: this.testMode,
    });

    // Create default adapters
    this.adapterRegistry.createDefaultAdapters();

    // Initialize device lifecycle manager
    this.deviceLifecycleManager = new DeviceLifecycleManager({
      adapterRegistry: this.adapterRegistry,
      db: this.db,
      discoveryManager: this.discoveryManager,
      stateManager: this.stateManager,
    });

    // Initialize hub initializer
    this.hubInitializer = new HubInitializer({
      db: this.db,
      hubId: this.hubId,
      stateManager: this.stateManager,
    });

    log('All modules initialized');
  }

  /**
   * Start the hub daemon
   */
  async start(): Promise<void> {
    if (this.running) {
      log('Daemon already running');
      return;
    }

    log('Starting hub daemon');

    try {
      // Initialize hub components (home, hub device, collectors)
      this.initializationResult = (await this.hubInitializer?.initialize()) || {
        eventCollector: null,
        homeId: null,
        hubDeviceId: null,
        metricsCollector: null,
      };

      // Set home ID in device lifecycle manager
      if (this.initializationResult.homeId && this.deviceLifecycleManager) {
        this.deviceLifecycleManager.setHomeId(this.initializationResult.homeId);
      }

      // Initialize command processor if we have event collector
      if (this.initializationResult.eventCollector && this.adapterRegistry) {
        this.commandProcessor = new CommandProcessor(
          this.adapterRegistry.getAll(),
          {
            db: this.db,
            entityAwareAdapters: this.adapterRegistry.getAllEntityAware(),
            eventCollector: this.initializationResult.eventCollector,
          },
        );
        log('Command processor initialized');
      }

      // Create lifecycle coordinator
      if (this.adapterRegistry && this.deviceLifecycleManager) {
        this.lifecycleCoordinator = new LifecycleCoordinator({
          components: {
            adapterRegistry: this.adapterRegistry,
            commandProcessor: this.commandProcessor,
            deviceLifecycleManager: this.deviceLifecycleManager,
            discoveryManager: this.discoveryManager,
            initializationResult: this.initializationResult,
          },
        });
      }

      // Start all components
      if (this.lifecycleCoordinator) {
        await this.lifecycleCoordinator.start();
      }

      this.running = true;
      log('Hub daemon started successfully');
    } catch (error) {
      log('Failed to start hub daemon:', error);
      throw error;
    }
  }

  /**
   * Stop the hub daemon
   */
  async stop(): Promise<void> {
    if (!this.running) {
      log('Daemon not running');
      return;
    }

    log('Stopping hub daemon');

    try {
      // Stop all components via lifecycle coordinator
      if (this.lifecycleCoordinator) {
        await this.lifecycleCoordinator.stop();
      }

      this.running = false;
      log('Hub daemon stopped');
    } catch (error) {
      log('Error stopping hub daemon:', error);
      throw error;
    }
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
    adapterCount: number;
    discoveryActive: boolean;
    databaseConnected: boolean;
    discoveredDevicesCount: number;
    hasCommandProcessor: boolean;
    hasEventCollector: boolean;
    hasMetricsCollector: boolean;
  } {
    const adapters = this.adapterRegistry?.getRegisteredProtocols() || [];
    const discoveredDevices = this.getDiscoveredDevices();

    return {
      adapterCount: adapters.length,
      adapters,
      databaseConnected: this.db !== null,
      discoveredDevicesCount: discoveredDevices.length,
      discoveryActive: this.discoveryManager.isActive(),
      hasCommandProcessor: this.commandProcessor !== null,
      hasEventCollector: this.initializationResult.eventCollector !== null,
      hasMetricsCollector: this.initializationResult.metricsCollector !== null,
      homeId: this.initializationResult.homeId,
      hubDeviceId: this.initializationResult.hubDeviceId,
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
    return this.adapterRegistry?.get(protocol);
  }

  /**
   * Get all protocol adapters
   */
  getAdapters(): Map<ProtocolType, ProtocolAdapter> {
    return this.adapterRegistry?.getAll() || new Map();
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
    return this.deviceLifecycleManager?.getDiscoveredDevices() || [];
  }

  /**
   * Get event collector
   */
  getEventCollector(): DeviceEventCollector | null {
    return this.initializationResult.eventCollector;
  }

  /**
   * Get metrics collector
   */
  getMetricsCollector(): DeviceMetricsCollector | null {
    return this.initializationResult.metricsCollector;
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
    return this.adapterRegistry?.getEntityAware(protocol);
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
    if (!this.deviceLifecycleManager) {
      log('Device lifecycle manager not available');
      return false;
    }

    return this.deviceLifecycleManager.sendEntityCommand(command);
  }

  /**
   * Log command event
   */
  async logCommandEvent(event: {
    entityId: string;
    capability: string;
    value: unknown;
    userId?: string;
    success: boolean;
    latency: number;
  }): Promise<void> {
    const log = debug('cove:hub:daemon:log-command');

    try {
      // Emit event for event collector
      this.initializationResult.eventCollector?.emit({
        eventType: HubEventType.CommandSent,
        message: `Entity command: ${event.entityId} ${event.capability} = ${event.value}`,
        metadata: {
          capability: event.capability,
          entityId: event.entityId,
          latency: event.latency,
          success: event.success,
          userId: event.userId,
          value: event.value,
        },
      });

      log(`Logged command event: ${event.success ? 'success' : 'failed'}`);
    } catch (error) {
      log('Error logging command event:', error);
    }
  }

  /**
   * Get daemon statistics
   */
  getStats(): {
    running: boolean;
    hubId: string;
    adapterCount: number;
    hasDatabase: boolean;
    hasStateManager: boolean;
    hasCommandProcessor: boolean;
    lifecycleStats: ReturnType<LifecycleCoordinator['getStats']> | undefined;
  } {
    return {
      adapterCount: this.adapterRegistry?.getAdapterCount() || 0,
      hasCommandProcessor: this.commandProcessor !== null,
      hasDatabase: this.db !== null,
      hasStateManager: this.stateManager !== null,
      hubId: this.hubId,
      lifecycleStats: this.lifecycleCoordinator?.getStats(),
      running: this.running,
    };
  }
}

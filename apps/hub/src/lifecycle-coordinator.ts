/**
 * Lifecycle Coordinator
 * Coordinates start/stop sequences across all hub components
 */

import type { DiscoveryManager } from '@cove/discovery';
import { debug } from '@cove/logger';
import { HubEventType } from '@cove/types';
import type { AdapterRegistry } from './adapters/registry';
import type { CommandProcessor } from './command-processor';
import type { DeviceLifecycleManager } from './device-lifecycle';
import type { HubInitializationResult } from './hub-initializer';

const log = debug('cove:hub:lifecycle-coordinator');

export interface LifecycleComponents {
  discoveryManager: DiscoveryManager;
  adapterRegistry: AdapterRegistry;
  deviceLifecycleManager: DeviceLifecycleManager;
  commandProcessor?: CommandProcessor | null;
  initializationResult: HubInitializationResult;
}

export interface LifecycleCoordinatorOptions {
  components: LifecycleComponents;
}

export class LifecycleCoordinator {
  private components: LifecycleComponents;
  private running = false;

  constructor(options: LifecycleCoordinatorOptions) {
    this.components = options.components;
    log('Lifecycle coordinator initialized');
  }

  /**
   * Start all components in the correct order
   */
  async start(): Promise<void> {
    if (this.running) {
      log('Lifecycle coordinator already running');
      return;
    }

    log('Starting lifecycle coordinator');

    try {
      // 1. Initialize all protocol adapters
      await this.initializeAdapters();

      // 2. Setup device lifecycle handlers
      this.setupDeviceLifecycleHandlers();

      // 3. Initialize command processor if available
      if (this.components.commandProcessor) {
        await this.components.commandProcessor.start();
        log('Command processor started');
      }

      // 4. Reconnect existing devices
      await this.reconnectExistingDevices();

      // 5. Start discovery
      await this.startDiscovery();

      this.running = true;
      log('Lifecycle coordinator started successfully');

      // Emit success event
      this.components.initializationResult.eventCollector?.emit({
        eventType: HubEventType.HubStarted,
        message: 'Hub daemon started successfully',
      });
    } catch (error) {
      log('Failed to start lifecycle coordinator:', error);

      // Emit error event
      this.components.initializationResult.eventCollector?.emit({
        eventType: HubEventType.SystemError,
        message: `Failed to start hub: ${error}`,
      });

      throw error;
    }
  }

  /**
   * Stop all components in the correct order
   */
  async stop(): Promise<void> {
    if (!this.running) {
      log('Lifecycle coordinator not running');
      return;
    }

    log('Stopping lifecycle coordinator');

    try {
      // 1. Stop discovery
      await this.stopDiscovery();

      // 2. Stop command processor
      if (this.components.commandProcessor) {
        await this.components.commandProcessor.stop();
        log('Command processor stopped');
      }

      // 3. Shutdown all adapters
      await this.shutdownAdapters();

      // 4. Stop collectors
      await this.stopCollectors();

      this.running = false;
      log('Lifecycle coordinator stopped');

      // Emit stop event
      this.components.initializationResult.eventCollector?.emit({
        eventType: HubEventType.HubStopped,
        message: 'Hub daemon stopped',
      });
    } catch (error) {
      log('Error stopping lifecycle coordinator:', error);
      throw error;
    }
  }

  /**
   * Initialize all protocol adapters
   */
  private async initializeAdapters(): Promise<void> {
    log('Initializing protocol adapters');

    const adapters = this.components.adapterRegistry.getAll();

    for (const [protocol, adapter] of adapters.entries()) {
      try {
        await adapter.initialize();
        log(`Initialized ${protocol} adapter`);

        this.components.initializationResult.eventCollector?.emit({
          eventType: HubEventType.AdapterInitialized,
          message: `${protocol} adapter initialized successfully`,
        });
      } catch (error) {
        log(`Failed to initialize ${protocol} adapter:`, error);
        this.components.initializationResult.eventCollector?.emit({
          eventType: HubEventType.AdapterError,
          message: `Failed to initialize ${protocol} adapter: ${error}`,
        });
      }
    }
  }

  /**
   * Setup device lifecycle event handlers
   */
  private setupDeviceLifecycleHandlers(): void {
    log('Setting up device lifecycle handlers');
    this.components.deviceLifecycleManager.setupDiscoveryHandlers();
  }

  /**
   * Reconnect existing devices
   */
  private async reconnectExistingDevices(): Promise<void> {
    log('Reconnecting existing devices');
    await this.components.deviceLifecycleManager.reconnectExistingDevices();
  }

  /**
   * Start discovery manager
   */
  private async startDiscovery(): Promise<void> {
    try {
      await this.components.discoveryManager.start();
      log('Discovery manager started');
    } catch (error) {
      log('Failed to start discovery manager:', error);
      this.components.initializationResult.eventCollector?.emit({
        eventType: HubEventType.SystemError,
        message: `Failed to start discovery manager: ${error}`,
      });
      throw error;
    }
  }

  /**
   * Stop discovery manager
   */
  private async stopDiscovery(): Promise<void> {
    try {
      await this.components.discoveryManager.stop();
      log('Discovery manager stopped');
    } catch (error) {
      log('Error stopping discovery manager:', error);
    }
  }

  /**
   * Shutdown all adapters
   */
  private async shutdownAdapters(): Promise<void> {
    log('Shutting down protocol adapters');

    const adapters = this.components.adapterRegistry.getAll();

    for (const [protocol, adapter] of adapters.entries()) {
      try {
        await adapter.shutdown();
        log(`Stopped ${protocol} adapter`);

        this.components.initializationResult.eventCollector?.emit({
          eventType: HubEventType.AdapterShutdown,
          message: `${protocol} adapter shut down`,
        });
      } catch (error) {
        log(`Error stopping ${protocol} adapter:`, error);
      }
    }
  }

  /**
   * Stop collectors
   */
  private async stopCollectors(): Promise<void> {
    log('Stopping collectors');

    if (this.components.initializationResult.metricsCollector) {
      this.components.initializationResult.metricsCollector.stop();
      log('Metrics collector stopped');
    }

    if (this.components.initializationResult.eventCollector) {
      await this.components.initializationResult.eventCollector.stop();
      log('Event collector stopped');
    }
  }

  /**
   * Check if coordinator is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get lifecycle statistics
   */
  getStats(): {
    running: boolean;
    adapterCount: number;
    hasCommandProcessor: boolean;
    hasEventCollector: boolean;
    hasMetricsCollector: boolean;
    hasHomeId: boolean;
    hasHubDeviceId: boolean;
  } {
    return {
      adapterCount: this.components.adapterRegistry.getAdapterCount(),
      hasCommandProcessor: this.components.commandProcessor !== null,
      hasEventCollector:
        this.components.initializationResult.eventCollector !== null,
      hasHomeId: this.components.initializationResult.homeId !== null,
      hasHubDeviceId: this.components.initializationResult.hubDeviceId !== null,
      hasMetricsCollector:
        this.components.initializationResult.metricsCollector !== null,
      running: this.running,
    };
  }
}

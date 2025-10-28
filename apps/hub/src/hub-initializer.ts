/**
 * Hub Initialization Module
 * Handles home registration, hub device registration, and collector initialization
 */

import { debug } from '@cove/logger';
import type { ProtocolType } from '@cove/types';
import type { HubDatabase } from './db';
import { env } from './env';
import type { DeviceEventCollector } from './events';
import { getHardwareId, getMacAddress, getSystemInfo } from './health';
import type { DeviceMetricsCollector } from './metrics';
import type { StateManager } from './state-manager';

const log = debug('cove:hub:initializer');

export interface HubInitializationResult {
  homeId: string | null;
  hubDeviceId: string | null;
  eventCollector: DeviceEventCollector | null;
  metricsCollector: DeviceMetricsCollector | null;
}

export interface HubInitializationOptions {
  hubId?: string;
  hubName?: string;
  db?: HubDatabase | null;
  stateManager?: StateManager | null;
}

export class HubInitializer {
  private hubId: string;
  private hubName: string;
  private db: HubDatabase | null;
  private stateManager: StateManager | null;

  constructor(options: HubInitializationOptions = {}) {
    this.hubId = options.hubId || env.HUB_ID || getHardwareId();
    this.hubName = options.hubName || env.HUB_NAME || 'Cove Hub';
    this.db = options.db || null;
    this.stateManager = options.stateManager || null;
    log('Hub initializer created');
  }

  /**
   * Initialize hub components
   */
  async initialize(): Promise<HubInitializationResult> {
    log('Starting hub initialization');

    const result: HubInitializationResult = {
      eventCollector: null,
      homeId: null,
      hubDeviceId: null,
      metricsCollector: null,
    };

    try {
      // Create or get home if database is enabled
      if (this.db) {
        result.homeId = await this.registerHome();
        if (result.homeId) {
          log(`Using home: ${result.homeId}`);
        }
      }

      // Register hub as a device if database is enabled
      if (this.db && result.homeId) {
        result.hubDeviceId = await this.registerHubAsDevice(result.homeId);
        if (result.hubDeviceId) {
          log(`Hub registered as device: ${result.hubDeviceId}`);
        }
      }

      // Initialize collectors after we have hub device ID
      if (result.hubDeviceId && result.homeId) {
        const collectors = await this.initializeCollectors(
          result.hubDeviceId,
          result.homeId,
        );
        result.eventCollector = collectors.eventCollector;
        result.metricsCollector = collectors.metricsCollector;
      }

      log('Hub initialization completed successfully');
      return result;
    } catch (error) {
      log('Hub initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register or get home
   */
  private async registerHome(): Promise<string | null> {
    if (!this.db) {
      log('No database available for home registration');
      return null;
    }

    try {
      const homeId = await this.db.registerHome(
        this.hubName,
        'America/Los_Angeles',
      );
      return homeId;
    } catch (error) {
      log('Failed to register home:', error);
      return null;
    }
  }

  /**
   * Register hub as a device
   */
  private async registerHubAsDevice(homeId: string): Promise<string | null> {
    if (!this.db) {
      log('No database available for hub device registration');
      return null;
    }

    try {
      const systemInfo = getSystemInfo();
      const macAddress = getMacAddress();

      const hubDevice = await this.db.registerHubAsDevice({
        categories: ['hub', 'system'],
        configUrl: `http://${systemInfo.ipAddress}:${env.PORT || 3100}`,
        entryType: 'service',
        externalId: macAddress || this.hubId,
        homeId,
        hostname: systemInfo.hostname,
        ipAddress: systemInfo.ipAddress,
        macAddress: macAddress || undefined,
        manufacturer: 'Cove',
        metadata: {
          apiPort: env.PORT || 3100,
          arch: systemInfo.arch,
          autoUpdate: true,
          discoveryEnabled: env.DISCOVERY_ENABLED,
          discoveryInterval: env.DISCOVERY_INTERVAL || 300,
          enabledProtocols: ['hue', 'sonos', 'esphome'],
          hardwareId: this.hubId,
          hostname: systemInfo.hostname,
          ipAddress: systemInfo.ipAddress,
          macAddress,
          memory: systemInfo.memory,
          nodeVersion: systemInfo.nodeVersion,
          platform: systemInfo.platform,
          telemetryInterval: env.TELEMETRY_INTERVAL || 30,
          updateChannel: 'stable',
          uptime: systemInfo.uptime,
        },
        model: 'Cove Hub',
        name: this.hubName,
        protocol: 'cove' as ProtocolType,
        swVersion: systemInfo.nodeVersion,
        type: 'hub',
      });

      return hubDevice?.id || null;
    } catch (error) {
      log('Failed to register hub as device:', error);
      return null;
    }
  }

  /**
   * Initialize event and metrics collectors
   */
  private async initializeCollectors(
    hubDeviceId: string,
    homeId: string,
  ): Promise<{
    eventCollector: DeviceEventCollector | null;
    metricsCollector: DeviceMetricsCollector | null;
  }> {
    log('Initializing collectors');

    try {
      // Import collectors dynamically to avoid circular dependencies
      const { DeviceEventCollector } = await import('./events');
      const { DeviceMetricsCollector } = await import('./metrics');

      const eventCollector = new DeviceEventCollector({
        db: this.db,
        deviceId: hubDeviceId,
        homeId,
      });

      const metricsCollector = new DeviceMetricsCollector({
        db: this.db,
        deviceId: hubDeviceId,
        homeId,
      });

      // Start collectors
      eventCollector.start();
      metricsCollector.start();

      log('Collectors initialized and started');

      return {
        eventCollector,
        metricsCollector,
      };
    } catch (error) {
      log('Failed to initialize collectors:', error);
      return {
        eventCollector: null,
        metricsCollector: null,
      };
    }
  }

  /**
   * Get hub ID
   */
  getHubId(): string {
    return this.hubId;
  }

  /**
   * Get hub name
   */
  getHubName(): string {
    return this.hubName;
  }

  /**
   * Get initialization statistics
   */
  getStats(): {
    hubId: string;
    hubName: string;
    hasDatabase: boolean;
    hasStateManager: boolean;
  } {
    return {
      hasDatabase: this.db !== null,
      hasStateManager: this.stateManager !== null,
      hubId: this.hubId,
      hubName: this.hubName,
    };
  }
}

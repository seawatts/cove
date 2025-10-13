/**
 * Core Hub Daemon
 * Orchestrates discovery, device management, and telemetry
 */

import { DiscoveryManager } from '@cove/discovery';
import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import type { ProtocolAdapter } from '@cove/types';
import { type DeviceDiscovery, DeviceType, ProtocolType } from '@cove/types';
import { HueAdapter } from './adapters';
import { CommandProcessor } from './command-processor';
import { env } from './env';
import { getSystemInfo } from './health';
import { SupabaseSync } from './supabase';

const log = debug('cove:daemon');

export class HubDaemon {
  private discoveryManager: DiscoveryManager;
  private supabaseSync: SupabaseSync | null = null;
  private commandProcessor: CommandProcessor | null = null;
  private protocolAdapters: Map<ProtocolType, ProtocolAdapter> = new Map();
  private running = false;
  private hubId: string;

  constructor(hubId?: string) {
    log('Initializing hub daemon');

    // Generate or use provided hub ID
    this.hubId = hubId || env.HUB_ID || createId({ prefix: 'hub' });

    this.discoveryManager = new DiscoveryManager();

    // Only initialize Supabase if URL and key are configured
    const hasSupabaseConfig =
      env.NEXT_PUBLIC_SUPABASE_URL &&
      (env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (hasSupabaseConfig) {
      try {
        this.supabaseSync = new SupabaseSync();
        log('Supabase sync enabled');
      } catch (error) {
        log('Failed to initialize Supabase sync:', error);
        log('Running in local-only mode');
      }
    } else {
      log('Running in local-only mode (no cloud sync)');
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

    // Register Hue adapter
    const hueAdapter = new HueAdapter();
    this.protocolAdapters.set(ProtocolType.Hue, hueAdapter);
    log('Registered Hue adapter');

    // TODO: Register other adapters (ESPHome, Matter, Zigbee, etc.)

    // Initialize command processor (only if Supabase is configured)
    const hasSupabaseConfig =
      env.NEXT_PUBLIC_SUPABASE_URL &&
      (env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (hasSupabaseConfig) {
      this.commandProcessor = new CommandProcessor(this.protocolAdapters);
      log('Command processor initialized');
    } else {
      log('Command processor disabled (no Supabase config)');
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      log('Daemon already running');
      return;
    }

    log('Starting hub daemon');

    // Initialize all protocol adapters
    for (const [protocol, adapter] of this.protocolAdapters.entries()) {
      try {
        await adapter.initialize();
        log(`Initialized ${protocol} adapter`);
      } catch (error) {
        log(`Failed to initialize ${protocol} adapter:`, error);
      }
    }

    // Register hub with Supabase if enabled
    if (this.supabaseSync) {
      const systemInfo = getSystemInfo();
      await this.supabaseSync.registerHub({
        id: this.hubId,
        name: env.HUB_NAME,
        online: true,
        systemInfo: {
          arch: systemInfo.arch,
          hostname: systemInfo.hostname,
          memory: systemInfo.memory,
          platform: systemInfo.platform,
          uptime: systemInfo.uptime,
        },
        version: env.HUB_VERSION,
      });

      // Start heartbeat
      this.supabaseSync.startHeartbeat(env.TELEMETRY_INTERVAL);
      log('Cloud sync active');
    }

    // Start discovery if enabled
    if (env.DISCOVERY_ENABLED) {
      await this.discoveryManager.start();
    }

    // Start command processor if enabled
    if (this.commandProcessor) {
      await this.commandProcessor.start();
      log('Command processor started');
    }

    this.running = true;
    log('Hub daemon started');
  }

  async stop(): Promise<void> {
    if (!this.running) {
      log('Daemon not running');
      return;
    }

    log('Stopping hub daemon');

    // Stop command processor
    if (this.commandProcessor) {
      await this.commandProcessor.stop();
      log('Command processor stopped');
    }

    // Stop discovery
    await this.discoveryManager.stop();

    // Shutdown all protocol adapters
    for (const [protocol, adapter] of this.protocolAdapters.entries()) {
      try {
        await adapter.shutdown();
        log(`Shut down ${protocol} adapter`);
      } catch (error) {
        log(`Failed to shutdown ${protocol} adapter:`, error);
      }
    }

    // Mark hub offline and stop heartbeat (if cloud sync enabled)
    if (this.supabaseSync) {
      await this.supabaseSync.markOffline();
    }

    this.running = false;
    log('Hub daemon stopped');
  }

  private async handleDeviceDiscovered(
    discovery: DeviceDiscovery,
  ): Promise<void> {
    log(`New device discovered: ${discovery.name} (${discovery.protocol})`);

    // Create a basic device object for the discovered device
    const device = {
      available: true,
      capabilities: [],
      config: discovery.metadata || {},
      createdAt: new Date(),
      deviceType: discovery.deviceType || DeviceType.Other,
      id: `${discovery.protocol}_${discovery.ipAddress?.replace(/\./g, '_') || Date.now()}`,
      ipAddress: discovery.ipAddress,
      name: discovery.name,
      online: true,
      orgId: undefined,
      protocol: discovery.protocol,
      state: {},
      updatedAt: new Date(),
      userId: '', // Will be set when user claims the device
    };

    // Sync discovered device to Supabase (if enabled)
    if (this.supabaseSync) {
      await this.supabaseSync.syncDevice(device);
    }

    // Attempt to connect to device using protocol adapter
    const adapter = this.protocolAdapters.get(discovery.protocol);
    if (adapter) {
      try {
        log(
          `Attempting to connect to ${discovery.protocol} device: ${discovery.name}`,
        );
        await adapter.connect(device);
        log(
          `Successfully connected to ${discovery.protocol} device: ${discovery.name}`,
        );

        // For Hue bridges, get all lights and sync them
        if (
          discovery.protocol === ProtocolType.Hue &&
          adapter instanceof HueAdapter
        ) {
          const lights = await adapter.getDevices(device.id);
          log(
            `Discovered ${lights.length} lights on Hue bridge ${device.name}`,
          );

          // Sync each light to Supabase
          if (this.supabaseSync) {
            for (const light of lights) {
              await this.supabaseSync.syncDevice(light);
            }
          }
        }
      } catch (error) {
        log(
          `Failed to connect to ${discovery.protocol} device ${discovery.name}:`,
          error,
        );
      }
    } else {
      log(`No adapter registered for protocol: ${discovery.protocol}`);
    }
  }

  private async handleDeviceLost(deviceId: string): Promise<void> {
    log(`Device lost: ${deviceId}`);

    // TODO: Update device status in Supabase
    // Mark as offline
  }

  getHubId(): string {
    return this.hubId;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get a protocol adapter by type
   */
  getAdapter<T extends ProtocolAdapter>(protocol: ProtocolType): T | undefined {
    return this.protocolAdapters.get(protocol) as T | undefined;
  }

  /**
   * Get all registered protocol adapters
   */
  getAdapters(): Map<ProtocolType, ProtocolAdapter> {
    return this.protocolAdapters;
  }

  /**
   * Get all discovered devices from all discovery services
   */
  getDiscoveredDevices(): DeviceDiscovery[] {
    return this.discoveryManager.getDiscoveredDevices();
  }
}

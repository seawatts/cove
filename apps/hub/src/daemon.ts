/**
 * Core Hub Daemon
 * Orchestrates discovery, device management, and telemetry
 */

import { DiscoveryManager } from '@cove/discovery';
import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import type { Device, ProtocolAdapter } from '@cove/types';
import {
  DeviceCapability,
  type DeviceDiscovery,
  DeviceType,
  EventSeverity,
  EventType,
  ProtocolType,
} from '@cove/types';
import { ESPHomeAdapter, HueAdapter } from './adapters';
import { CommandProcessor } from './command-processor';
import { env } from './env';
import { DeviceEventCollector } from './events';
import { getSystemInfo } from './health';
import { DeviceMetricsCollector } from './metrics';
import { StateManager } from './state-manager';
import { SupabaseSync } from './supabase';

const log = debug('cove:daemon');

export class HubDaemon {
  private discoveryManager: DiscoveryManager;
  private supabaseSync: SupabaseSync | null = null;
  private stateManager: StateManager | null = null;
  private commandProcessor: CommandProcessor | null = null;
  private protocolAdapters: Map<ProtocolType, ProtocolAdapter> = new Map();
  private running = false;
  private hubId: string;
  private hubDeviceId: string | null = null; // Hub's device ID in Devices table
  private eventCollector: DeviceEventCollector | null = null;
  private metricsCollector: DeviceMetricsCollector | null = null;

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
        this.supabaseSync = new SupabaseSync(env.HUB_USER_ID, env.HUB_ORG_ID);
        log('Supabase sync enabled');

        // Initialize StateManager with Supabase sync
        this.stateManager = new StateManager(this.supabaseSync);
        log('StateManager initialized');
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

    try {
      // Register ESPHome adapter with StateManager and SupabaseSync
      const esphomeAdapter = new ESPHomeAdapter(
        this.stateManager,
        this.supabaseSync,
      );
      this.protocolAdapters.set(ProtocolType.ESPHome, esphomeAdapter);
      log('Registered ESPHome adapter');

      // Register Hue adapter with StateManager
      const hueAdapter = new HueAdapter(this.stateManager);
      this.protocolAdapters.set(ProtocolType.Hue, hueAdapter);
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

    // Register hub as a device if Supabase is enabled
    if (this.supabaseSync) {
      const systemInfo = getSystemInfo();

      // Use hub ID as external ID for deduplication
      // This ensures we reuse the same device record on restart
      const hubExternalId = `hub_${this.hubId}`;

      const hubDevice = await this.supabaseSync.registerHubAsDevice({
        available: true,
        capabilities: [],
        config: {
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
        deviceType: DeviceType.CoveHub, // Our Cove Hub (not a connected hub device)
        externalId: hubExternalId, // External ID for deduplication
        hubId: undefined, // Hub doesn't have a parent hub
        ipAddress: systemInfo.ipAddress, // Use actual IP address instead of hostname
        manufacturer: 'Cove',
        model: 'Cove Hub',
        name: env.HUB_NAME || 'Cove Hub',
        online: true,
        state: {
          online: true,
          uptime: systemInfo.uptime,
        },
        version: env.HUB_VERSION || '0.1.0',
      });

      if (hubDevice?.id) {
        this.hubDeviceId = hubDevice.id;
        log(
          `Hub registered as device: ${this.hubDeviceId} (external: ${hubExternalId})`,
        );
      }
    }

    // Initialize event and metrics collectors after we have hub device ID
    if (this.hubDeviceId) {
      this.eventCollector = new DeviceEventCollector({
        deviceId: this.hubDeviceId,
        supabaseSync: this.supabaseSync,
      });

      this.metricsCollector = new DeviceMetricsCollector({
        deviceId: this.hubDeviceId,
        supabaseSync: this.supabaseSync,
      });

      // Start collectors
      this.eventCollector.start();
      this.metricsCollector.start();

      // Initialize command processor now that we have event collector
      // (only if Supabase is configured)
      if (this.supabaseSync) {
        this.commandProcessor = new CommandProcessor(this.protocolAdapters, {
          eventCollector: this.eventCollector,
          supabaseSync: this.supabaseSync,
        });
        log('Command processor initialized with event collector');
      }
    }

    // Initialize all protocol adapters
    for (const [protocol, adapter] of this.protocolAdapters.entries()) {
      try {
        await adapter.initialize();
        log(`Initialized ${protocol} adapter`);

        this.eventCollector?.emit({
          eventType: EventType.AdapterInitialized,
          message: `${protocol} adapter initialized successfully`,
          metadata: { protocol },
          severity: EventSeverity.Info,
        });
      } catch (error) {
        log(`Failed to initialize ${protocol} adapter:`, error);

        this.eventCollector?.emit({
          eventType: EventType.AdapterError,
          message: `Failed to initialize ${protocol} adapter: ${error}`,
          metadata: { error: String(error), protocol },
          severity: EventSeverity.Error,
        });
      }
    }

    // Start heartbeat to keep hub device updated (if cloud sync enabled)
    if (this.supabaseSync && this.hubDeviceId) {
      this.supabaseSync.startHeartbeat(
        this.hubDeviceId,
        env.TELEMETRY_INTERVAL || 30,
      );
      log('Cloud sync active');

      this.eventCollector?.emit({
        eventType: EventType.SyncSuccess,
        message: 'Cloud sync enabled and hub registered',
        severity: EventSeverity.Info,
      });
    }

    // Start discovery if enabled
    if (env.DISCOVERY_ENABLED) {
      await this.discoveryManager.start();
    }

    // Start command processor (if initialized)
    if (this.commandProcessor) {
      await this.commandProcessor.start();
      log('Command processor started');
    } else {
      log('Command processor not initialized (no Supabase config)');
    }

    // Update metrics with initial adapter count
    this.metricsCollector?.setActiveProtocols(this.protocolAdapters.size);

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

        this.eventCollector?.emit({
          eventType: EventType.AdapterShutdown,
          message: `${protocol} adapter shut down`,
          metadata: { protocol },
          severity: EventSeverity.Info,
        });
      } catch (error) {
        log(`Failed to shutdown ${protocol} adapter:`, error);

        this.eventCollector?.emit({
          eventType: EventType.AdapterError,
          message: `Failed to shutdown ${protocol} adapter: ${error}`,
          metadata: { error: String(error), protocol },
          severity: EventSeverity.Error,
        });
      }
    }

    // Mark hub device offline and stop heartbeat (if cloud sync enabled)
    if (this.supabaseSync && this.hubDeviceId) {
      await this.supabaseSync.markDeviceOffline(this.hubDeviceId);
    }

    // Stop collectors (this will trigger final sync)
    if (this.metricsCollector) {
      await this.metricsCollector.stop();
    }
    if (this.eventCollector) {
      await this.eventCollector.stop();
    }

    this.running = false;
    log('Hub daemon stopped');
  }

  private async handleDeviceDiscovered(
    discovery: DeviceDiscovery,
  ): Promise<void> {
    log(`New device discovered: ${discovery.name} (${discovery.protocol})`);

    this.eventCollector?.emit({
      eventType: EventType.DeviceDiscovered,
      message: `Discovered ${discovery.protocol} device: ${discovery.name}`,
      metadata: {
        deviceName: discovery.name,
        ipAddress: discovery.ipAddress,
        protocol: discovery.protocol,
      },
      severity: EventSeverity.Info,
    });

    // Generate a stable, protocol-specific external ID for deduplication
    // This is NOT the database ID - Drizzle will generate that (device_xxxxx)
    const externalId = this.generateExternalId(discovery);
    log(`Generated external ID: ${externalId}`);

    // Determine device type, capabilities, and metadata based on protocol
    let deviceType = discovery.deviceType || DeviceType.Other;
    let capabilities: DeviceCapability[] = [];
    let manufacturer: string | undefined;
    let model: string | undefined;
    let nativeType: string | undefined;

    switch (discovery.protocol) {
      case ProtocolType.Sonos:
        deviceType = DeviceType.Speaker;
        capabilities = [
          DeviceCapability.AudioVolume,
          DeviceCapability.AudioPlayback,
        ];
        manufacturer = 'Sonos, Inc.';
        // Model will be fetched from device description XML (TODO: implement in adapter)
        if (discovery.metadata?.txt) {
          const txt = discovery.metadata.txt as Record<string, string>;
          nativeType = txt.modelNumber;
        }
        break;

      case ProtocolType.Hue:
        // Hue bridges will be detected, but actual lights are handled by adapter
        deviceType = DeviceType.Hub;
        manufacturer = 'Signify Netherlands B.V.';
        model = 'Hue Bridge';
        break;

      case ProtocolType.ESPHome:
        // ESPHome device type varies - keep as-is or Other
        manufacturer = 'Espressif';
        if (discovery.metadata?.txt) {
          const txt = discovery.metadata.txt as Record<string, string>;
          model = txt.board || 'ESP32';
          nativeType = txt.device_class;
        } else {
          model = 'ESP32';
        }
        break;

      default:
        // Keep default behavior
        break;
    }

    const device = {
      available: true,
      capabilities,
      config: {
        ...(discovery.metadata || {}),
        nativeType, // Store protocol's original device type
      },
      createdAt: new Date(),
      deviceType,
      externalId,
      host: discovery.metadata?.host as string | undefined,
      ipAddress: discovery.ipAddress,
      macAddress: discovery.macAddress,
      manufacturer, // Top-level field for searching
      model, // Top-level field for searching
      name: discovery.name,
      online: true,
      orgId: undefined,
      protocol: discovery.protocol,
      state: {},
      updatedAt: new Date(),
      userId: undefined, // Will be set when user claims the device
    };

    // Sync discovered device to Supabase (if enabled)
    let syncedDevice: Device | null = device;
    if (this.supabaseSync) {
      syncedDevice = await this.supabaseSync.syncDevice(device);
    }

    // Use the synced device with database-generated ID for further operations
    if (!syncedDevice?.id) {
      log('Failed to sync device or device ID not generated');
      return;
    }

    // Attempt to connect to device using protocol adapter
    const adapter = this.protocolAdapters.get(discovery.protocol);
    if (adapter) {
      try {
        log(
          `Attempting to connect to ${discovery.protocol} device: ${discovery.name}`,
        );
        await adapter.connect(syncedDevice);
        log(
          `Successfully connected to ${discovery.protocol} device: ${discovery.name}`,
        );

        this.eventCollector?.emit({
          eventType: EventType.DeviceConnected,
          message: `Connected to ${discovery.protocol} device: ${discovery.name}`,
          metadata: {
            deviceId: syncedDevice.id,
            deviceName: discovery.name,
            protocol: discovery.protocol,
          },
          severity: EventSeverity.Info,
        });

        // Update connected devices count
        this.updateConnectedDevicesCount();

        // For Hue bridges, get all lights and sync them
        if (
          discovery.protocol === ProtocolType.Hue &&
          adapter instanceof HueAdapter
        ) {
          const lights = await adapter.getDevices(syncedDevice.id);
          log(
            `Discovered ${lights.length} lights on Hue bridge ${syncedDevice.name}`,
          );

          // Sync each light to Supabase
          if (this.supabaseSync) {
            for (const light of lights) {
              await this.supabaseSync.syncDevice(light);
            }
          }

          // Update connected devices count after adding lights
          this.updateConnectedDevicesCount();
        }
      } catch (error) {
        log(
          `Failed to connect to ${discovery.protocol} device ${discovery.name}:`,
          error,
        );

        this.eventCollector?.emit({
          eventType: EventType.AdapterError,
          message: `Failed to connect to ${discovery.protocol} device ${discovery.name}: ${error}`,
          metadata: {
            deviceName: discovery.name,
            error: String(error),
            protocol: discovery.protocol,
          },
          severity: EventSeverity.Error,
        });
      }
    } else {
      log(`No adapter registered for protocol: ${discovery.protocol}`);

      this.eventCollector?.emit({
        eventType: EventType.AdapterError,
        message: `No adapter registered for protocol: ${discovery.protocol}`,
        metadata: {
          protocol: discovery.protocol,
        },
        severity: EventSeverity.Warning,
      });
    }
  }

  private async handleDeviceLost(deviceId: string): Promise<void> {
    log(`Device lost: ${deviceId}`);

    this.eventCollector?.emit({
      eventType: EventType.DeviceLost,
      message: `Device lost: ${deviceId}`,
      metadata: {
        deviceId,
      },
      severity: EventSeverity.Warning,
    });

    // Update connected devices count
    this.updateConnectedDevicesCount();

    // TODO: Update device status in Supabase
    // Mark as offline
  }

  /**
   * Update connected devices count in metrics collector
   */
  private updateConnectedDevicesCount(): void {
    let totalDevices = 0;

    // Count devices from all adapters
    for (const _adapter of this.protocolAdapters.values()) {
      // This is a simplified count - in reality, we'd need to track this more carefully
      totalDevices += 1;
    }

    this.metricsCollector?.setConnectedDevices(totalDevices);
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

  /**
   * Get event collector for accessing events
   */
  getEventCollector(): DeviceEventCollector | null {
    return this.eventCollector;
  }

  /**
   * Get metrics collector for accessing metrics
   */
  getMetricsCollector(): DeviceMetricsCollector | null {
    return this.metricsCollector;
  }

  /**
   * Get hub's device ID
   */
  getHubDeviceId(): string | null {
    return this.hubDeviceId;
  }

  /**
   * Generate a stable, protocol-specific external ID for a discovered device
   * This is used for deduplication and is NOT the database ID
   *
   * Priority:
   * 1. Protocol-specific unique identifier (e.g., Hue uniqueid, ESPHome device name)
   * 2. MAC address
   * 3. IP + port + protocol (for devices on unique IPs)
   * 4. Fallback to metadata-based hash
   */
  private generateExternalId(discovery: DeviceDiscovery): string {
    const metadata = discovery.metadata || {};

    // Protocol-specific ID generation
    switch (discovery.protocol) {
      case ProtocolType.Hue:
        // Hue devices: use bridgeId if it's a bridge, or we'll handle lights via adapter
        // For now, use IP + protocol for bridges (adapters will handle lights)
        if (metadata.bridgeId) {
          return `hue_bridge_${metadata.bridgeId}`;
        }
        break;

      case ProtocolType.ESPHome:
        // ESPHome devices typically have a unique device name
        if (metadata.device_name || metadata.name) {
          const deviceName = (metadata.device_name || metadata.name) as string;
          return `esphome_${deviceName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
        break;

      case ProtocolType.Matter:
        // Matter devices have unique identifiers
        if (metadata.uniqueId || metadata.deviceId) {
          const matterId = (metadata.uniqueId || metadata.deviceId) as string;
          return `matter_${matterId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
        break;

      case ProtocolType.MQTT:
        // MQTT devices often have a topic or client ID
        if (metadata.clientId || metadata.topic) {
          const mqttId = (metadata.clientId || metadata.topic) as string;
          return `mqtt_${mqttId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
        break;

      case ProtocolType.Sonos:
        // Sonos devices have a unique RINCON identifier in TXT records
        if (metadata.txt && typeof metadata.txt === 'object') {
          const txt = metadata.txt as Record<string, string>;
          if (txt.uuid) {
            // UUID format: RINCON_7828CA22AF1C01400
            return `sonos_${txt.uuid.replace(/[^a-zA-Z0-9]/g, '_')}`;
          }
        }
        break;
    }

    // Fallback 1: MAC address (most reliable for network devices)
    if (discovery.macAddress) {
      const sanitizedMac = discovery.macAddress
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
      return `${discovery.protocol}_mac_${sanitizedMac}`;
    }

    // Fallback 2: IP + port + protocol
    if (discovery.ipAddress) {
      const sanitizedIp = discovery.ipAddress.replace(/[^a-zA-Z0-9]/g, '_');
      const port = metadata.port ? `_port_${metadata.port}` : '';
      return `${discovery.protocol}_ip_${sanitizedIp}${port}`;
    }

    // Fallback 3: Name-based (least reliable, but better than nothing)
    const sanitizedName = discovery.name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    return `${discovery.protocol}_name_${sanitizedName}`;
  }
}

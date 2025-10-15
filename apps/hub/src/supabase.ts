/**
 * Supabase Client for Hub
 * Handles cloud sync, realtime subscriptions, and device state management
 */

import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import type {
  Device,
  DeviceEvent,
  DeviceMetric,
  DeviceStateHistory,
} from '@cove/types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

const log = debug('cove:hub:supabase');

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    log('Initializing Supabase client');

    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Supabase URL and key required for cloud sync');
    }

    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

export class SupabaseSync {
  private client: SupabaseClient;
  private heartbeatInterval: Timer | null = null;
  private hubDeviceId: string | null = null;
  private userId: string | undefined;
  private orgId: string | undefined;

  constructor(userId?: string, orgId?: string) {
    this.client = getSupabaseClient();
    this.userId = userId;
    this.orgId = orgId;
  }

  /**
   * Start heartbeat to keep hub device status updated
   */
  startHeartbeat(deviceId: string, intervalSeconds = 30): void {
    if (this.heartbeatInterval) {
      log('Heartbeat already running');
      return;
    }

    this.hubDeviceId = deviceId;
    log(
      `Starting heartbeat every ${intervalSeconds} seconds for device ${deviceId}`,
    );

    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, intervalSeconds * 1000);

    // Send first heartbeat immediately
    void this.sendHeartbeat();
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      log('Heartbeat stopped');
    }
  }

  /**
   * Send heartbeat update - updates hub device record
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.hubDeviceId) return;

    try {
      const { error } = await this.client
        .from('devices')
        .update({
          lastSeen: new Date().toISOString(),
          online: true,
        })
        .eq('id', this.hubDeviceId);

      if (error) {
        log('Heartbeat error:', error);
      } else {
        log('Heartbeat sent');
      }
    } catch (error) {
      log('Failed to send heartbeat:', error);
    }
  }

  /**
   * Sync device to Supabase
   * Uses externalId for deduplication - multiple syncs of the same device update the existing record
   */
  async syncDevice(device: Partial<Device>): Promise<Device | null> {
    try {
      const deviceData: Record<string, unknown> = {
        ...device,
        // Set hubId to the hub's device ID (if hub is registered)
        hubId: device.hubId !== undefined ? device.hubId : this.hubDeviceId,
        lastSeen: new Date().toISOString(),
      };

      // Generate ID if not provided - Postgres doesn't have a default for this field
      // Drizzle's $defaultFn only works when using Drizzle ORM, not raw Supabase client
      if (!deviceData.id) {
        deviceData.id = createId({ prefix: 'device' });
      }

      // Add userId and orgId if available
      if (this.userId) {
        deviceData.userId = this.userId;
      }
      if (this.orgId) {
        deviceData.orgId = this.orgId;
      }

      // Check if device with this externalId already exists
      if (device.externalId) {
        const { data: existingDevice } = await this.client
          .from('devices')
          .select('id')
          .eq('externalId', device.externalId)
          .single();

        // If existing device has different ID, clean up orphaned state history
        if (existingDevice && existingDevice.id !== deviceData.id) {
          log(
            `Cleaning up orphaned state history for device ${existingDevice.id} (being replaced by ${deviceData.id})`,
          );

          // Delete orphaned state history that would cause FK constraint violation
          const { error: deleteError } = await this.client
            .from('states')
            .delete()
            .eq('deviceId', existingDevice.id);

          if (deleteError) {
            log(
              'Warning: Failed to clean up orphaned state history:',
              deleteError,
            );
          } else {
            log(
              `Cleaned up orphaned state history for device ${existingDevice.id}`,
            );
          }

          // Use the existing device ID to avoid FK issues
          deviceData.id = existingDevice.id;
        }
      }

      // Use externalId for conflict resolution - prevents duplicates
      const { data, error } = await this.client
        .from('devices')
        .upsert(deviceData, {
          onConflict: 'externalId', // Use externalId instead of id for deduplication
        })
        .select()
        .single();

      if (error) {
        log('Error syncing device:', error);
        return null;
      }

      log(`Device synced: ${data.id} (external: ${data.externalId})`);
      return data as Device;
    } catch (error) {
      log('Failed to sync device:', error);
      return null;
    }
  }

  /**
   * Update device state
   */
  async updateDeviceState(
    deviceId: string,
    state: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('devices')
        .update({
          lastSeen: new Date().toISOString(),
          state,
        })
        .eq('id', deviceId);

      if (error) {
        log('Error updating device state:', error);
        return false;
      }

      return true;
    } catch (error) {
      log('Failed to update device state:', error);
      return false;
    }
  }

  /**
   * Insert device metric
   */
  async insertMetric(metric: Omit<DeviceMetric, 'id'>): Promise<boolean> {
    try {
      const { error } = await this.client.from('deviceMetrics').insert({
        deviceId: metric.deviceId,
        metricType: metric.metricType,
        timestamp: metric.timestamp || new Date().toISOString(),
        unit: metric.unit,
        value: metric.value,
      });

      if (error) {
        log('Error inserting metric:', error);
        return false;
      }

      return true;
    } catch (error) {
      log('Failed to insert metric:', error);
      return false;
    }
  }

  /**
   * Batch insert metrics for performance
   * @deprecated Use insertStateHistoryBatch instead - metrics are now state history
   */
  async insertMetricsBatch(
    metrics: Array<Omit<DeviceMetric, 'id'>>,
  ): Promise<boolean> {
    if (metrics.length === 0) return true;

    try {
      const { error } = await this.client.from('deviceMetrics').insert(
        metrics.map((m) => ({
          deviceId: m.deviceId,
          metricType: m.metricType,
          timestamp: m.timestamp || new Date().toISOString(),
          unit: m.unit,
          value: m.value,
        })),
      );

      if (error) {
        log('Error inserting metrics batch:', error);
        return false;
      }

      log(`Inserted ${metrics.length} metrics`);
      return true;
    } catch (error) {
      log('Failed to insert metrics batch:', error);
      return false;
    }
  }

  /**
   * Insert device state history (replaces metrics)
   * Follows Home Assistant pattern where state changes are the history
   */
  async insertStateHistory(state: DeviceStateHistory): Promise<boolean> {
    try {
      const { error } = await this.client.from('states').insert({
        attributes: state.attributes,
        deviceId: state.deviceId,
        id: state.id,
        lastChanged: state.lastChanged.toISOString(),
        lastUpdated: state.lastUpdated.toISOString(),
        state: state.state,
      });

      if (error) {
        log('Error inserting state history:', error);
        return false;
      }

      return true;
    } catch (error) {
      log('Failed to insert state history:', error);
      return false;
    }
  }

  /**
   * Batch insert state history for performance
   */
  async insertStateHistoryBatch(
    states: DeviceStateHistory[],
  ): Promise<boolean> {
    if (states.length === 0) return true;

    try {
      const { error } = await this.client.from('states').insert(
        states.map((s) => ({
          attributes: s.attributes,
          deviceId: s.deviceId,
          id: s.id,
          lastChanged: s.lastChanged.toISOString(),
          lastUpdated: s.lastUpdated.toISOString(),
          state: s.state,
        })),
      );

      if (error) {
        log('Error inserting state history batch:', error);
        return false;
      }

      log(`Inserted ${states.length} state history records`);
      return true;
    } catch (error) {
      log('Failed to insert state history batch:', error);
      return false;
    }
  }

  /**
   * Subscribe to device commands from cloud
   */
  subscribeToCommands(
    _callback: (command: {
      deviceId: string;
      capability: string;
      value: unknown;
    }) => void,
  ): void {
    // TODO: Implement realtime subscriptions for commands
    // This would listen to a 'device_commands' table or use Supabase Realtime
    log('Command subscriptions not yet implemented');
  }

  /**
   * Mark hub device as offline before shutdown
   */
  async markDeviceOffline(deviceId: string): Promise<void> {
    this.stopHeartbeat();

    try {
      await this.client
        .from('devices')
        .update({
          lastSeen: new Date().toISOString(),
          online: false,
        })
        .eq('id', deviceId);

      log('Hub device marked offline');
    } catch (error) {
      log('Failed to mark hub device offline:', error);
    }
  }

  /**
   * Insert a single device event
   */
  async insertDeviceEvent(event: DeviceEvent): Promise<boolean> {
    try {
      const { error } = await this.client.from('events').insert({
        deviceId: event.deviceId,
        eventType: event.eventType,
        message: event.message,
        metadata: event.metadata,
        severity: event.severity,
        timestamp: event.timestamp.toISOString(),
      });

      if (error) {
        log('Error inserting device event:', error);
        return false;
      }

      return true;
    } catch (error) {
      log('Failed to insert device event:', error);
      return false;
    }
  }

  /**
   * Upsert ESPHome entities to database
   */
  async upsertEntities(
    deviceId: string,
    entities: Array<{
      key: number;
      name: string;
      objectId?: string;
      type: string;
      icon?: string;
      deviceClass?: string;
      unitOfMeasurement?: string;
      minValue?: number;
      maxValue?: number;
      step?: number;
      supportsBrightness?: boolean;
      supportsColorTemp?: boolean;
      supportsRgb?: boolean;
      effects?: string[];
      disabled?: boolean;
      currentValue?: unknown;
    }>,
  ): Promise<void> {
    try {
      const entityRecords = entities.map((entity) => ({
        currentValue: entity.currentValue,
        deviceClass: entity.deviceClass,
        deviceId,
        disabled: entity.disabled || false,
        effects: entity.effects,
        entityType: entity.type,
        icon: entity.icon,
        id: createId({ prefix: 'entity' }),
        key: entity.key,
        maxValue: entity.maxValue,
        minValue: entity.minValue,
        name: entity.name,
        objectId: entity.objectId,
        step: entity.step,
        supportsBrightness: entity.supportsBrightness,
        supportsColorTemp: entity.supportsColorTemp,
        supportsRgb: entity.supportsRgb,
        unitOfMeasurement: entity.unitOfMeasurement,
      }));

      // Upsert each entity using deviceId + objectId as conflict key
      for (const entity of entityRecords) {
        const { error } = await this.client.from('entities').upsert(entity, {
          onConflict: 'deviceId,objectId',
        });

        if (error) {
          log(`Error upserting entity ${entity.name}:`, error);
        }
      }

      log(`Upserted ${entities.length} entities for device ${deviceId}`);
    } catch (error) {
      log('Failed to upsert entities:', error);
    }
  }

  /**
   * Batch insert device events
   */
  async insertDeviceEvents(events: DeviceEvent[]): Promise<boolean> {
    if (events.length === 0) return true;

    try {
      const { error } = await this.client.from('events').insert(
        events.map((e) => ({
          deviceId: e.deviceId,
          eventType: e.eventType,
          id: e.id,
          message: e.message,
          metadata: e.metadata,
          severity: e.severity,
          stateId: e.stateId, // Optional link to state history
          timestamp: e.timestamp.toISOString(),
        })),
      );

      if (error) {
        log('Error inserting device events batch:', error);
        return false;
      }

      log(`Inserted ${events.length} device events`);
      return true;
    } catch (error) {
      log('Failed to insert device events batch:', error);
      return false;
    }
  }

  /**
   * Register hub as a device in the Devices table
   */
  async registerHubAsDevice(device: Partial<Device>): Promise<Device | null> {
    try {
      log(`Registering hub as device: ${device.name}`);

      if (!device.externalId) {
        log('Error: externalId is required to register hub as device');
        return null;
      }

      // Check if hub already exists by externalId
      const { data: existing } = await this.client
        .from('devices')
        .select('*')
        .eq('externalId', device.externalId)
        .maybeSingle();

      if (existing) {
        // Hub exists - UPDATE only (don't touch ID field)
        const { data, error } = await this.client
          .from('devices')
          .update({
            available: device.available,
            config: device.config,
            deviceType: device.deviceType,
            host: device.host,
            ipAddress: device.ipAddress,
            lastSeen: new Date().toISOString(),
            manufacturer: device.manufacturer,
            model: device.model,
            name: device.name,
            online: device.online,
            state: device.state,
            version: device.version,
          })
          .eq('externalId', device.externalId)
          .select()
          .single();

        if (error) {
          log('Error updating hub device:', error);
          return null;
        }

        this.hubDeviceId = data.id;
        log(`Hub device updated: ${data.id} (external: ${data.externalId})`);
        return data as Device;
      }
      // Hub doesn't exist - INSERT
      const deviceData: Record<string, unknown> = {
        available: device.available,
        capabilities: device.capabilities,
        config: device.config,
        deviceType: device.deviceType,
        externalId: device.externalId,
        host: device.host,
        hubId: device.hubId,
        id: device.id || createId({ prefix: 'device' }),
        ipAddress: device.ipAddress,
        lastSeen: new Date().toISOString(),
        macAddress: device.macAddress,
        manufacturer: device.manufacturer,
        model: device.model,
        name: device.name,
        online: device.online,
        protocol: device.protocol,
        state: device.state,
        version: device.version,
      };

      // Add userId and orgId
      if (this.userId) {
        deviceData.userId = this.userId;
      }
      if (this.orgId) {
        deviceData.orgId = this.orgId;
      }

      const { data, error } = await this.client
        .from('devices')
        .insert(deviceData)
        .select()
        .single();

      if (error) {
        log('Error inserting hub device:', error);
        return null;
      }

      this.hubDeviceId = data.id;
      log(
        `Hub registered as device successfully: ${data.id} (external: ${data.externalId})`,
      );
      return data as Device;
    } catch (error) {
      log('Failed to register hub as device:', error);
      return null;
    }
  }
}

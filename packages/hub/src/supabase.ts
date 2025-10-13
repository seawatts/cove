/**
 * Supabase Client for Hub
 * Handles cloud sync, realtime subscriptions, and device state management
 */

import { debug } from '@cove/logger';
import type { Device, DeviceMetric, Hub } from '@cove/types';
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
  private hubId: string | null = null;

  constructor() {
    this.client = getSupabaseClient();
  }

  /**
   * Register or update the hub in Supabase
   */
  async registerHub(hub: Partial<Hub>): Promise<Hub | null> {
    try {
      log(`Registering hub: ${hub.name}`);

      const { data, error } = await this.client
        .from('hubs')
        .upsert(
          {
            config: hub.config,
            id: hub.id,
            ipAddress: hub.ipAddress,
            lastSeen: new Date().toISOString(),
            macAddress: hub.macAddress,
            name: hub.name || env.HUB_NAME,
            online: true,
            systemInfo: hub.systemInfo,
            version: hub.version || env.HUB_VERSION,
          },
          {
            onConflict: 'id',
          },
        )
        .select()
        .single();

      if (error) {
        log('Error registering hub:', error);
        return null;
      }

      this.hubId = data.id;
      log(`Hub registered successfully: ${data.id}`);
      return data as Hub;
    } catch (error) {
      log('Failed to register hub:', error);
      return null;
    }
  }

  /**
   * Start heartbeat to keep hub status updated
   */
  startHeartbeat(intervalSeconds = 30): void {
    if (this.heartbeatInterval) {
      log('Heartbeat already running');
      return;
    }

    if (!this.hubId) {
      log('Cannot start heartbeat: hub not registered');
      return;
    }

    log(`Starting heartbeat every ${intervalSeconds} seconds`);

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
   * Send heartbeat update
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.hubId) return;

    try {
      const { error } = await this.client
        .from('hubs')
        .update({
          lastSeen: new Date().toISOString(),
          online: true,
        })
        .eq('id', this.hubId);

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
   */
  async syncDevice(device: Partial<Device>): Promise<Device | null> {
    try {
      const { data, error } = await this.client
        .from('devices')
        .upsert(
          {
            ...device,
            hubId: this.hubId,
            lastSeen: new Date().toISOString(),
          },
          {
            onConflict: 'id',
          },
        )
        .select()
        .single();

      if (error) {
        log('Error syncing device:', error);
        return null;
      }

      log(`Device synced: ${data.id}`);
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
   * Mark hub as offline before shutdown
   */
  async markOffline(): Promise<void> {
    if (!this.hubId) return;

    this.stopHeartbeat();

    try {
      await this.client
        .from('hubs')
        .update({
          lastSeen: new Date().toISOString(),
          online: false,
        })
        .eq('id', this.hubId);

      log('Hub marked offline');
    } catch (error) {
      log('Failed to mark hub offline:', error);
    }
  }
}

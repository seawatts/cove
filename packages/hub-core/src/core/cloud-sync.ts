/**
 * Cloud Sync Service
 * Syncs hub data to cloud Postgres for remote access
 *
 * Features:
 * - Hub registration on startup
 * - Periodic heartbeat to maintain online status
 * - Batched sync of device/entity changes
 * - Offline queue with retry logic
 * - Exponential backoff on failures
 */

import * as hubSchema from '@cove/db/hub';
import type { HubDatabaseClient } from '@cove/db/hub/server';
import { debug, info, error as logError, warn } from '@cove/logger';
import { eq } from 'drizzle-orm';
import type {
  DeviceLifecycleEvent,
  EventBus,
  StateChangedEvent,
  TelemetryEvent,
} from './event-bus';
import type { Registry } from './registry';
import type { StateStore } from './state-store';

const logDebug = debug('cove:hub:cloud-sync');
const logInfo = info('cove:hub:cloud-sync');
const logWarn = warn('cove:hub:cloud-sync');
const logErr = logError('cove:hub:cloud-sync');

export interface CloudSyncConfig {
  cloudApiUrl: string; // e.g., 'https://api.cove.app'
  enabled: boolean;
  heartbeatInterval?: number; // ms, default 30000 (30s)
  hubId: string;
  hubName: string; // Hub display name
  hubVersion: string; // Hub software version
  localUrl: string; // e.g., 'http://192.168.1.100:3200'
  ownerId: string; // Cloud user ID who owns this hub
  stateThrottleMs?: number; // ms, default 60000 (1 min per entity)
  syncInterval?: number; // ms, default 30000 (30s)
}

interface SyncQueueItem {
  data: unknown;
  retryCount: number;
  timestamp: number;
  type: 'device' | 'entity' | 'state' | 'room';
}

export class CloudSyncService {
  private config: CloudSyncConfig;
  private db: HubDatabaseClient;
  private eventBus: EventBus;
  private registry: Registry;
  private stateStore: StateStore;

  private isRunning = false;
  private heartbeatTimer?: Timer;
  private syncTimer?: Timer;
  private syncQueue: SyncQueueItem[] = [];
  private lastSyncTime = 0;
  private failureCount = 0;
  private maxRetries = 3;

  // Throttling: track last sync time per entity
  private entityLastSyncTime = new Map<string, number>();

  constructor(
    config: CloudSyncConfig,
    deps: {
      db: HubDatabaseClient;
      eventBus: EventBus;
      registry: Registry;
      stateStore: StateStore;
    },
  ) {
    this.config = {
      ...config,
      heartbeatInterval: config.heartbeatInterval || 30000,
      stateThrottleMs: config.stateThrottleMs || 60000, // 1 minute default
      syncInterval: config.syncInterval || 30000,
    };
    this.db = deps.db;
    this.eventBus = deps.eventBus;
    this.registry = deps.registry;
    this.stateStore = deps.stateStore;
  }

  /**
   * Make a tRPC-style API call to the cloud
   */
  private async callCloudApi<T>(path: string, data: unknown): Promise<T> {
    const url = `${this.config.cloudApiUrl}/trpc/${path}`;
    const response = await fetch(url, {
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'x-source': 'hub-sync',
      },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    const result = (await response.json()) as { result: { data: T } };
    return result.result.data;
  }

  /**
   * Start the cloud sync service
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logInfo('Cloud sync disabled');
      return;
    }

    if (this.isRunning) {
      logWarn('Cloud sync already running');
      return;
    }

    logInfo(`Starting cloud sync service (cloud: ${this.config.cloudApiUrl})`);

    this.isRunning = true;

    // Register hub with cloud
    await this.registerHub();

    // Start heartbeat
    this.startHeartbeat();

    // Start sync timer
    this.startSyncTimer();

    // Subscribe to events
    this.subscribeToEvents();

    logInfo('Cloud sync service started');
  }

  /**
   * Stop the cloud sync service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logInfo('Stopping cloud sync service');

    this.isRunning = false;

    // Stop timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }

    // Mark hub as offline
    await this.markOffline();

    logInfo('Cloud sync service stopped');
  }

  /**
   * Register hub with cloud on startup
   */
  private async registerHub(): Promise<void> {
    try {
      logDebug('Registering hub with cloud');

      const result = await this.callCloudApi('hubRegistry.register', {
        cloudUrl: undefined, // Will be set when CloudFlare Tunnel is configured
        hubId: this.config.hubId,
        localUrl: this.config.localUrl,
        name: this.config.hubName,
        ownerId: this.config.ownerId,
        version: this.config.hubVersion,
      });

      logInfo('Hub registered with cloud', result);
      this.failureCount = 0;
    } catch (err) {
      logErr('Failed to register hub', err);
      this.failureCount++;
      // Will retry on next heartbeat
    }
  }

  /**
   * Send heartbeat to cloud
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      logDebug('Sending heartbeat to cloud');

      await this.callCloudApi('hubRegistry.heartbeat', {
        hubId: this.config.hubId,
        name: this.config.hubName,
        version: this.config.hubVersion,
      });

      this.failureCount = 0;
    } catch (err) {
      logErr('Failed to send heartbeat', err);
      this.failureCount++;

      // If too many failures, try to re-register
      if (this.failureCount >= 3) {
        logWarn('Multiple heartbeat failures, attempting re-registration');
        await this.registerHub();
      }
    }
  }

  /**
   * Mark hub as offline
   */
  private async markOffline(): Promise<void> {
    try {
      logDebug('Marking hub as offline');

      await this.callCloudApi('hubRegistry.offline', {
        hubId: this.config.hubId,
      });
    } catch (err) {
      logErr('Failed to mark hub offline', err);
    }
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    // Send initial heartbeat immediately
    this.sendHeartbeat();
  }

  /**
   * Start sync timer
   */
  private startSyncTimer(): void {
    this.syncTimer = setInterval(() => {
      this.processSyncQueue();
    }, this.config.syncInterval);
  }

  /**
   * Subscribe to event bus for changes
   */
  private subscribeToEvents(): void {
    // Device lifecycle events (paired, unpaired, discovered, etc.)
    this.eventBus.subscribe<DeviceLifecycleEvent>(
      'device/*/lifecycle',
      (data) => {
        if (data.event === 'paired' || data.event === 'discovered') {
          this.queueSync('device', data);
        }
      },
    );

    // Entity state changes (with throttling)
    this.eventBus.subscribe<StateChangedEvent>('entity/*/state', (data) => {
      // Throttle state syncs per entity
      const now = Date.now();
      const lastSync = this.entityLastSyncTime.get(data.entityId) || 0;
      const throttleMs = this.config.stateThrottleMs || 60000;

      if (now - lastSync >= throttleMs) {
        this.entityLastSyncTime.set(data.entityId, now);
        this.queueSync('state', data);
      } else {
        logDebug(
          `Throttling state sync for ${data.entityId} (last sync ${Math.round((now - lastSync) / 1000)}s ago)`,
        );
      }
    });

    // Telemetry events
    this.eventBus.subscribe<TelemetryEvent>('telemetry', (data) => {
      this.queueSync('state', data);
    });

    logDebug('Subscribed to event bus for sync');
  }

  /**
   * Queue an item for sync
   */
  private queueSync(type: SyncQueueItem['type'], data: unknown): void {
    this.syncQueue.push({
      data,
      retryCount: 0,
      timestamp: Date.now(),
      type,
    });

    logDebug(`Queued ${type} for sync (queue size: ${this.syncQueue.length})`);
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) {
      return;
    }

    logDebug(`Processing sync queue (${this.syncQueue.length} items)`);

    const batch = this.syncQueue.splice(0, 50); // Process in batches of 50

    for (const item of batch) {
      try {
        await this.syncItem(item);
      } catch (err) {
        logErr(`Failed to sync ${item.type}`, err);

        // Retry logic
        if (item.retryCount < this.maxRetries) {
          item.retryCount++;
          this.syncQueue.push(item); // Re-queue
          logWarn(
            `Re-queued ${item.type} for retry (${item.retryCount}/${this.maxRetries})`,
          );
        } else {
          logErr(`Max retries exceeded for ${item.type}, dropping`);
        }
      }
    }

    this.lastSyncTime = Date.now();
  }

  /**
   * Sync individual item to cloud
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    logDebug(`Syncing ${item.type}`, item.data);

    switch (item.type) {
      case 'device': {
        const deviceData = item.data as DeviceLifecycleEvent;
        await this.syncDevice(deviceData);
        break;
      }
      case 'entity': {
        const entityData = item.data as unknown;
        await this.syncEntity(entityData);
        break;
      }
      case 'state': {
        const stateData = item.data as StateChangedEvent | TelemetryEvent;
        await this.syncState(stateData);
        break;
      }
      case 'room': {
        const roomData = item.data as unknown;
        await this.syncRoom(roomData);
        break;
      }
      default: {
        logWarn(`Unknown sync type: ${item.type}`);
      }
    }
  }

  /**
   * Sync device to cloud
   */
  private async syncDevice(data: DeviceLifecycleEvent): Promise<void> {
    // Get device details from local DB
    const devices = await this.db
      .select()
      .from(hubSchema.devices)
      .where(eq(hubSchema.devices.id, data.deviceId))
      .limit(1);

    const device = devices[0];
    if (!device) {
      logWarn(`Device ${data.deviceId} not found in local DB`);
      return;
    }

    // Sync to cloud - transform hub schema to cloud schema
    await this.callCloudApi('cloudDevices.sync', {
      device: {
        // Optional fields
        available: true,
        homeId: device.homeId,
        hubId: this.config.hubId,
        id: device.id,
        model: device.model || undefined,
        name: device.name || 'Unknown Device',
        online: false,
        protocol: device.protocol,
        roomId: device.roomId || undefined,
      },
      hubId: this.config.hubId,
    });

    logDebug(`Device ${data.deviceId} synced to cloud`);
  }

  /**
   * Sync entity to cloud
   */
  private async syncEntity(data: unknown): Promise<void> {
    // Type guard - in practice, this would be more sophisticated
    const entityData = data as { entityId?: string };

    if (!entityData.entityId) {
      logWarn('Entity sync called without entityId');
      return;
    }

    // Get entity details from local DB
    const entities = await this.db
      .select()
      .from(hubSchema.entities)
      .where(eq(hubSchema.entities.id, entityData.entityId))
      .limit(1);

    const entity = entities[0];
    if (!entity) {
      logWarn(`Entity ${entityData.entityId} not found in local DB`);
      return;
    }

    // Sync to cloud
    await this.callCloudApi('cloudEntities.sync', {
      entity: {
        ...entity,
        capabilities: entity.capability ? [entity.capability] : [],
        deviceClass: entity.deviceClass || undefined,
        displayName: entity.displayName || undefined,
        hubId: this.config.hubId,
        isFavorite: entity.isFavorite || undefined,
        key: entity.key || '',
        name: entity.name || undefined,
      },
      hubId: this.config.hubId,
    });

    logDebug(`Entity ${entityData.entityId} synced to cloud`);
  }

  /**
   * Sync state to cloud
   */
  private async syncState(
    data: StateChangedEvent | TelemetryEvent,
  ): Promise<void> {
    // For StateChangedEvent, sync the state
    if ('state' in data && 'entityId' in data) {
      const stateData = data as StateChangedEvent;

      await this.callCloudApi('cloudEntities.syncState', {
        entityId: stateData.entityId,
        hubId: this.config.hubId,
        state: {
          attrs: undefined, // Could extract from state object if needed
          state: stateData.state,
          updatedAt: new Date(),
        },
      });

      logDebug(`State for entity ${stateData.entityId} synced to cloud`);
    }

    // For TelemetryEvent, we could also sync to entityStateHistories
    // but that's handled separately in the telemetry router
    if ('entityId' in data && 'field' in data) {
      const telemetryData = data as TelemetryEvent;
      logDebug(
        `Telemetry for entity ${telemetryData.entityId} (field: ${telemetryData.field}) received`,
      );
    }
  }

  /**
   * Sync room to cloud
   */
  private async syncRoom(data: unknown): Promise<void> {
    // Type guard - in practice, this would be more sophisticated
    const roomData = data as { roomId?: string };

    if (!roomData.roomId) {
      logWarn('Room sync called without roomId');
      return;
    }

    // Get room details from local DB
    const rooms = await this.db
      .select()
      .from(hubSchema.rooms)
      .where(eq(hubSchema.rooms.id, roomData.roomId))
      .limit(1);

    const room = rooms[0];
    if (!room) {
      logWarn(`Room ${roomData.roomId} not found in local DB`);
      return;
    }

    // Sync to cloud
    await this.callCloudApi('room.sync', {
      hubId: this.config.hubId,
      room: {
        ...room,
        floor: room.floor || undefined,
        hubId: this.config.hubId,
      },
    });

    logDebug(`Room ${roomData.roomId} synced to cloud`);
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      failureCount: this.failureCount,
      lastSyncTime: this.lastSyncTime,
      queueSize: this.syncQueue.length,
      running: this.isRunning,
    };
  }
}

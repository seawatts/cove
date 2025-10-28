/**
 * Database Layer for Hub Daemon
 * Uses Drizzle ORM with Home Assistant++ schema
 * Replaces SupabaseSync with direct schema operations
 */

import type { Device, Entity, EntityStateHistory } from '@cove/db';
import { db } from '@cove/db/client';
import {
  devices,
  entities,
  entityStateHistories,
  entityStates,
  events,
  homes,
} from '@cove/db/schema';
import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import type { EntityKind, ProtocolType } from '@cove/types';
import type { InferInsertModel } from 'drizzle-orm';
import { and, desc, eq } from 'drizzle-orm';

const log = debug('cove:hub:db');

// Insert types for database operations
type HomeInsert = InferInsertModel<typeof homes>;
type DeviceInsert = InferInsertModel<typeof devices>;
type EntityInsert = InferInsertModel<typeof entities>;
type EntityStateHistoryInsert = InferInsertModel<typeof entityStateHistories>;

export class HubDatabase {
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private hubDeviceId: string | null = null;

  constructor() {
    log('Hub database layer initialized');
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
      await db
        .update(devices)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(devices.id, this.hubDeviceId));

      log('Heartbeat sent');
    } catch (error) {
      log('Failed to send heartbeat:', error);
    }
  }

  /**
   * Register or get home
   */
  async registerHome(
    name: string,
    timezone = 'America/Los_Angeles',
    address?: Record<string, unknown>,
  ): Promise<string | null> {
    try {
      // Check if home already exists by name
      const existingHome = await db.query.homes.findFirst({
        where: eq(homes.name, name),
      });

      if (existingHome) {
        log(`Using existing home: ${existingHome.id} (${name})`);
        return existingHome.id;
      }

      // Create new home with conflict handling
      const homeId = createId({ prefix: 'home' });
      const homeData: HomeInsert = {
        address,
        id: homeId,
        name,
        timezone,
      };

      const result = await db
        .insert(homes)
        .values(homeData)
        .onConflictDoNothing()
        .returning();

      // If insert was skipped due to conflict, try to find it again
      if (result.length === 0) {
        const existingAfterConflict = await db.query.homes.findFirst({
          where: eq(homes.name, name),
        });
        if (existingAfterConflict) {
          log(
            `Using existing home after conflict: ${existingAfterConflict.id} (${name})`,
          );
          return existingAfterConflict.id;
        }
      }

      log(`Created home: ${homeId} (${name})`);
      return homeId;
    } catch (error) {
      log('Failed to register home:', error);
      return null;
    }
  }

  /**
   * Register hub as a device
   */
  async registerHubAsDevice(params: {
    homeId: string;
    name: string;
    protocol: ProtocolType;
    type?: string;
    categories?: string[];
    ipAddress?: string;
    macAddress?: string;
    hostname?: string;
    port?: number;
    manufacturer?: string;
    model?: string;
    swVersion?: string;
    hwVersion?: string;
    externalId?: string;
    configUrl?: string;
    entryType?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Device | null> {
    try {
      log(`Registering hub as device: ${params.name}`);

      // Check if hub device already exists by externalId or MAC address
      const externalId = params.externalId || params.macAddress;
      if (externalId) {
        const existingDevice = await db.query.devices.findFirst({
          where: and(
            eq(devices.homeId, params.homeId),
            eq(devices.externalId, externalId),
          ),
        });

        if (existingDevice) {
          log(
            `Using existing hub device: ${existingDevice.id} (${params.name})`,
          );
          this.hubDeviceId = existingDevice.id;
          return existingDevice as Device;
        }
      }

      const deviceId = createId({ prefix: 'device' });
      const deviceData: DeviceInsert = {
        available: true,
        categories: params.categories || ['hub', 'system'],
        configUrl: params.configUrl,
        entryType: 'service',
        externalId: externalId,
        homeId: params.homeId,
        hostname: params.hostname,
        hwVersion: params.hwVersion,
        id: deviceId,
        ipAddress: params.ipAddress,
        macAddress: params.macAddress,
        manufacturer: params.manufacturer || 'Cove',
        metadata: params.metadata,
        model: params.model || 'Cove Hub',
        name: params.name,
        port: params.port,
        protocol: params.protocol,
        swVersion: params.swVersion,
        type: params.type || 'hub',
      };

      const result = await db
        .insert(devices)
        .values(deviceData)
        .onConflictDoNothing()
        .returning();

      // If insert was skipped due to conflict, try to find it again
      if (result.length === 0 && externalId) {
        const existingDevicesAfterConflict = await db
          .select()
          .from(devices)
          .where(
            and(
              eq(devices.homeId, params.homeId),
              eq(devices.manufacturer, params.manufacturer || 'Cove'),
              eq(devices.model, params.model || 'Cove Hub'),
            ),
          );

        const existingDeviceAfterConflict = existingDevicesAfterConflict.find(
          (d) => d.externalId === externalId,
        );

        if (existingDeviceAfterConflict) {
          log(
            `Using existing hub device after conflict: ${existingDeviceAfterConflict.id} (${params.name})`,
          );
          this.hubDeviceId = existingDeviceAfterConflict.id;
          return existingDeviceAfterConflict as Device;
        }
      }

      this.hubDeviceId = deviceId;
      log(`Hub registered as device: ${deviceId}`);
      return deviceData as Device;
    } catch (error) {
      log('Failed to register hub as device:', error);
      return null;
    }
  }

  /**
   * Insert device record
   */
  async insertDevice(params: {
    homeId: string;
    name: string;
    protocol: ProtocolType; // Now required
    manufacturer?: string;
    model?: string;
    swVersion?: string;
    hwVersion?: string;
    ipAddress?: string;
    macAddress?: string;
    hostname?: string;
    port?: number;
    externalId?: string; // For deduplication
    type?: string;
    categories?: string[];
    metadata?: Record<string, unknown>; // Now for protocol-specific only
    roomId?: string;
    viaDeviceId?: string;
    matterNodeId?: number;
    configUrl?: string;
    entryType?: string;
    disabledBy?: string;
  }): Promise<Device | null> {
    try {
      // Check for existing device by externalId first, then fallback to IP+name
      if (params.externalId) {
        const existingDevice = await db.query.devices.findFirst({
          where: and(
            eq(devices.homeId, params.homeId),
            eq(devices.externalId, params.externalId),
          ),
        });

        if (existingDevice) {
          log(
            `Using existing device by externalId: ${existingDevice.id} (${params.name})`,
          );
          return existingDevice as Device;
        }
      }

      // Fallback to IP address and name combination
      if (params.ipAddress) {
        const existingDevice = await db.query.devices.findFirst({
          where: and(
            eq(devices.homeId, params.homeId),
            eq(devices.ipAddress, params.ipAddress),
            eq(devices.name, params.name),
          ),
        });

        if (existingDevice) {
          log(
            `Using existing device by IP+name: ${existingDevice.id} (${params.name})`,
          );
          return existingDevice as Device;
        }
      }

      const deviceId = createId({ prefix: 'device' });
      const deviceData: DeviceInsert = {
        available: true,
        categories: params.categories || [],
        configUrl: params.configUrl,
        disabledBy: params.disabledBy,
        entryType: params.entryType || 'device',
        externalId: params.externalId,
        homeId: params.homeId,
        hostname: params.hostname,
        hwVersion: params.hwVersion,
        id: deviceId,
        ipAddress: params.ipAddress,
        macAddress: params.macAddress,
        manufacturer: params.manufacturer,
        matterNodeId: params.matterNodeId,
        metadata: params.metadata,
        model: params.model,
        name: params.name,
        port: params.port,
        protocol: params.protocol,
        roomId: params.roomId,
        swVersion: params.swVersion,
        type: params.type,
        viaDeviceId: params.viaDeviceId,
      };

      const result = await db
        .insert(devices)
        .values(deviceData)
        .onConflictDoNothing()
        .returning();

      // If insert was skipped due to conflict, try to find it again
      if (result.length === 0 && params.externalId) {
        const existingAfterConflict = await db.query.devices.findFirst({
          where: and(
            eq(devices.homeId, params.homeId),
            eq(devices.externalId, params.externalId),
          ),
        });

        if (existingAfterConflict) {
          log(
            `Using existing device after conflict: ${existingAfterConflict.id} (${params.name})`,
          );
          return existingAfterConflict as Device;
        }
      }

      log(`Inserted device: ${deviceId} (${params.name})`);
      return deviceData as Device;
    } catch (error) {
      log('Failed to insert device:', error);
      return null;
    }
  }

  /**
   * Create or get entity record
   */
  async createEntity(params: {
    deviceId: string;
    kind: EntityKind;
    key: string;
    deviceClass?: string;
    capabilities: import('@cove/db').EntityCapability[];
    name?: string;
  }): Promise<string | null> {
    try {
      // First, try to find existing entity by key
      const existing = await db.query.entities.findFirst({
        where: eq(entities.key, params.key),
      });

      if (existing) {
        log(
          `Using existing entity: ${existing.id} (${params.kind}: ${params.key})`,
        );
        return existing.id;
      }

      // Create new entity with conflict handling
      const entityId = createId({ prefix: 'entity' });
      const entityData: EntityInsert = {
        capabilities: params.capabilities,
        deviceClass: params.deviceClass,
        deviceId: params.deviceId,
        id: entityId,
        key: params.key,
        kind: params.kind,
        name: params.name,
      };

      const result = await db
        .insert(entities)
        .values(entityData)
        .onConflictDoNothing()
        .returning();

      // If insert was skipped due to conflict, try to find it again
      if (result.length === 0) {
        const existingAfterConflict = await db.query.entities.findFirst({
          where: eq(entities.key, params.key),
        });
        if (existingAfterConflict) {
          log(
            `Using existing entity after conflict: ${existingAfterConflict.id} (${params.kind}: ${params.key})`,
          );
          return existingAfterConflict.id;
        }
      }

      log(`Created entity: ${entityId} (${params.kind}: ${params.key})`);
      return entityId;
    } catch (error) {
      log('Failed to create entity:', error);
      return null;
    }
  }

  /**
   * Upsert entity state (latest state per entity)
   */
  async upsertEntityState(params: {
    entityId: string;
    state: string;
    attrs?: Record<string, unknown>;
  }): Promise<boolean> {
    try {
      await db
        .insert(entityStates)
        .values({
          attrs: params.attrs,
          entityId: params.entityId,
          state: params.state,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            attrs: params.attrs,
            state: params.state,
            updatedAt: new Date(),
          },
          target: entityStates.entityId,
        });

      return true;
    } catch (error) {
      log('Failed to upsert entity state:', error);
      return false;
    }
  }

  /**
   * Get all devices for a specific home
   */
  async getDevicesByHomeId(homeId: string): Promise<Device[]> {
    try {
      const deviceList = await db
        .select()
        .from(devices)
        .where(eq(devices.homeId, homeId));

      return deviceList as Device[];
    } catch (error) {
      log('Failed to get devices by home ID:', error);
      return [];
    }
  }

  /**
   * Insert entity state history record
   */
  async insertEntityStateHistory(params: {
    entityId: string;
    homeId: string;
    state: string;
    attrs?: Record<string, unknown>;
    timestamp?: Date;
  }): Promise<boolean> {
    try {
      const historyData: EntityStateHistoryInsert = {
        attrs: params.attrs,
        entityId: params.entityId,
        homeId: params.homeId,
        state: params.state,
        ts: params.timestamp || new Date(),
      };

      await db.insert(entityStateHistories).values(historyData);
      return true;
    } catch (error) {
      log('Failed to insert entity state history:', error);
      return false;
    }
  }

  /**
   * Get entities for a device
   */
  async getEntitiesForDevice(deviceId: string): Promise<Entity[]> {
    try {
      const entityList = await db.query.entities.findMany({
        where: eq(entities.deviceId, deviceId),
      });

      return entityList;
    } catch (error) {
      log('Failed to fetch entities for device:', error);
      return [];
    }
  }

  /**
   * Get entity with device info
   */
  async getEntityWithDevice(entityId: string): Promise<{
    entity: Entity;
    device: Device;
  } | null> {
    try {
      const result = await db
        .select()
        .from(entities)
        .innerJoin(devices, eq(devices.id, entities.deviceId))
        .where(eq(entities.id, entityId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }
      if (!result[0]?.devices || !result[0]?.entities) {
        throw new Error('Entity or device not found');
      }
      return {
        device: result[0].devices,
        entity: result[0].entities,
      };
    } catch (error) {
      log('Failed to get entity with device:', error);
      return null;
    }
  }

  /**
   * Get recent entity state history
   */
  async getEntityStateHistory(params: {
    entityId: string;
    limit?: number;
    since?: Date;
  }): Promise<EntityStateHistory[]> {
    try {
      const conditions = [eq(entityStateHistories.entityId, params.entityId)];

      if (params.since) {
        // Note: This would need a proper date comparison - simplified for now
        conditions.push(eq(entityStateHistories.entityId, params.entityId));
      }

      const query = db
        .select()
        .from(entityStateHistories)
        .where(and(...conditions))
        .orderBy(desc(entityStateHistories.ts))
        .limit(params.limit || 100);

      const history = await query;
      return history;
    } catch (error) {
      log('Failed to get entity state history:', error);
      return [];
    }
  }

  /**
   * Insert device event
   */
  async insertDeviceEvent(params: {
    homeId: string;
    eventType: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    try {
      await db.insert(events).values({
        eventType: params.eventType,
        homeId: params.homeId,
        message: params.message,
        metadata: params.metadata,
        ts: new Date(),
      });
      return true;
    } catch (error) {
      log('Failed to insert device event:', error);
      return false;
    }
  }

  /**
   * Mark hub device as offline before shutdown
   */
  async markDeviceOffline(deviceId: string): Promise<void> {
    this.stopHeartbeat();

    try {
      await db
        .update(devices)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(devices.id, deviceId));

      log('Hub device marked offline');
    } catch (error) {
      log('Failed to mark hub device offline:', error);
    }
  }

  /**
   * Get hub device ID
   */
  getHubDeviceId(): string | null {
    return this.hubDeviceId;
  }
}

/**
 * Registry - Device and entity CRUD operations for Hub V2
 * Handles device fingerprint deduplication and entity management
 */

import { debug } from '@cove/logger';
import { and, eq } from 'drizzle-orm';
import type { DatabaseClient } from '../db';
import { credentials, devices, entities, homes } from '../db';
import type { DeviceDescriptor, EntityDescriptor } from './driver-kit';

const log = debug('cove:hub-v2:registry');

export interface RegistryOptions {
  db: DatabaseClient;
}

/**
 * Registry class
 */
export class Registry {
  private db: DatabaseClient;

  constructor(options: RegistryOptions) {
    this.db = options.db;
  }

  /**
   * Get or create a home
   */
  async getOrCreateHome(name: string, timezone = 'America/Los_Angeles') {
    try {
      // Try to find existing home by name
      const existingHome = await this.db.query.homes.findFirst({
        where: eq(homes.name, name),
      });

      if (existingHome) {
        log(`Using existing home: ${existingHome.id} (${name})`);
        return existingHome;
      }

      // Create new home
      const newHome = await this.db
        .insert(homes)
        .values({
          name,
          timezone,
        })
        .returning();

      if (!newHome[0]) {
        throw new Error('Failed to create home');
      }

      log(`Created new home: ${newHome[0].id} (${name})`);
      return newHome[0];
    } catch (error) {
      log('Failed to get or create home:', error);
      throw error;
    }
  }

  /**
   * Upsert device with fingerprint deduplication
   */
  async upsertDevice(
    deviceDesc: DeviceDescriptor,
    homeId: string,
    roomId?: string,
  ) {
    try {
      // First check by fingerprint if available
      if (deviceDesc.meta?.fingerprint) {
        const existingByFingerprint = await this.db.query.devices.findFirst({
          where: and(
            eq(devices.fingerprint, deviceDesc.meta.fingerprint as string),
            eq(devices.homeId, homeId),
          ),
        });

        if (existingByFingerprint) {
          log(
            `Using existing device by fingerprint: ${existingByFingerprint.id} (${deviceDesc.name})`,
          );

          // Update last seen and address if changed
          await this.db
            .update(devices)
            .set({
              ip: deviceDesc.address,
              lastSeen: new Date(),
              name: deviceDesc.name,
            })
            .where(eq(devices.id, existingByFingerprint.id));

          return existingByFingerprint;
        }
      }

      // Check by address and vendor/model combination
      if (deviceDesc.address) {
        const existingByAddress = await this.db.query.devices.findFirst({
          where: and(
            eq(devices.ip, deviceDesc.address),
            eq(devices.vendor, deviceDesc.vendor),
            eq(devices.model, deviceDesc.model || ''),
            eq(devices.homeId, homeId),
          ),
        });

        if (existingByAddress) {
          log(
            `Using existing device by address: ${existingByAddress.id} (${deviceDesc.name})`,
          );

          // Update last seen
          await this.db
            .update(devices)
            .set({ lastSeen: new Date() })
            .where(eq(devices.id, existingByAddress.id));

          return existingByAddress;
        }
      }

      // Create new device
      const newDevice = await this.db
        .insert(devices)
        .values({
          fingerprint: deviceDesc.meta?.fingerprint as string,
          homeId,
          ip: deviceDesc.address,
          lastSeen: new Date(),
          model: deviceDesc.model,
          name: deviceDesc.name,
          protocol: deviceDesc.protocol,
          roomId,
          vendor: deviceDesc.vendor,
        })
        .returning();

      if (!newDevice[0]) {
        throw new Error('Failed to create device');
      }

      log(`Created new device: ${newDevice[0].id} (${deviceDesc.name})`);
      return newDevice[0];
    } catch (error) {
      log('Failed to upsert device:', error);
      throw error;
    }
  }

  /**
   * Upsert entity
   */
  async upsertEntity(
    entityDesc: EntityDescriptor,
    deviceId: string,
    homeId: string,
  ) {
    try {
      // Check if entity already exists by key
      const lookupKey = entityDesc.metadata?.key
        ? String(entityDesc.metadata.key)
        : entityDesc.id;
      const existingEntity = await this.db.query.entities.findFirst({
        where: and(
          eq(entities.deviceId, deviceId),
          eq(entities.key, lookupKey),
        ),
      });

      if (existingEntity) {
        log(
          `Using existing entity: ${existingEntity.id} (${entityDesc.kind}: ${entityDesc.id})`,
        );
        return existingEntity;
      }

      // Create new entity
      const newEntity = await this.db
        .insert(entities)
        .values({
          capability: entityDesc.capability,
          deviceId,
          homeId,
          key: entityDesc.metadata?.key
            ? String(entityDesc.metadata.key)
            : entityDesc.id,
          kind: entityDesc.kind,
          name: entityDesc.name,
        })
        .returning();

      if (!newEntity[0]) {
        throw new Error('Failed to create entity');
      }

      log(
        `Created new entity: ${newEntity[0].id} (${entityDesc.kind}: ${entityDesc.id})`,
      );
      return newEntity[0];
    } catch (error) {
      log('Failed to upsert entity:', error);
      throw error;
    }
  }

  /**
   * Store device credentials
   */
  async storeCredentials(
    deviceId: string,
    kind: string,
    credentialData: unknown,
  ) {
    try {
      // Encrypt credential data (simple base64 for now, should use proper encryption)
      const blob = Buffer.from(JSON.stringify(credentialData));

      await this.db
        .insert(credentials)
        .values({
          blob,
          deviceId,
          kind,
        })
        .onConflictDoUpdate({
          set: {
            blob,
            kind,
          },
          target: credentials.deviceId,
        });

      log(`Stored credentials for device: ${deviceId} (${kind})`);
    } catch (error) {
      log('Failed to store credentials:', error);
      throw error;
    }
  }

  /**
   * Get device credentials
   */
  async getCredentials(deviceId: string, kind?: string) {
    try {
      const where = kind
        ? and(eq(credentials.deviceId, deviceId), eq(credentials.kind, kind))
        : eq(credentials.deviceId, deviceId);

      const creds = await this.db.query.credentials.findFirst({
        where,
      });

      if (!creds) return null;

      // Decrypt credential data (simple base64 for now)
      const credentialData = JSON.parse((creds.blob as Buffer).toString());
      return credentialData;
    } catch (error) {
      log('Failed to get credentials:', error);
      return null;
    }
  }

  /**
   * Get devices by home ID
   */
  async getDevicesByHome(homeId: string) {
    try {
      return await this.db.query.devices.findMany({
        where: eq(devices.homeId, homeId),
        with: {
          entities: true,
          room: true,
        },
      });
    } catch (error) {
      log('Failed to get devices by home:', error);
      return [];
    }
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
    try {
      const conditions = [];

      if (filters.homeId) {
        conditions.push(eq(entities.homeId, filters.homeId));
      }

      if (filters.deviceId) {
        conditions.push(eq(entities.deviceId, filters.deviceId));
      }

      if (filters.kind) {
        conditions.push(eq(entities.kind, filters.kind));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return await this.db.query.entities.findMany({
        where,
        with: {
          device: {
            with: {
              room: true,
            },
          },
          state: true,
        },
      });
    } catch (error) {
      log('Failed to get entities:', error);
      return [];
    }
  }

  /**
   * Get entity by ID
   */
  async getEntity(entityId: string) {
    try {
      return await this.db.query.entities.findFirst({
        where: eq(entities.id, entityId),
        with: {
          device: {
            with: {
              room: true,
            },
          },
          state: true,
        },
      });
    } catch (error) {
      log('Failed to get entity:', error);
      return null;
    }
  }

  /**
   * Get device by ID
   */
  async getDevice(deviceId: string) {
    try {
      return await this.db.query.devices.findFirst({
        where: eq(devices.id, deviceId),
        with: {
          credentials: true,
          entities: true,
          room: true,
        },
      });
    } catch (error) {
      log('Failed to get device:', error);
      return null;
    }
  }

  /**
   * Mark device as paired
   */
  async markDevicePaired(deviceId: string) {
    try {
      await this.db
        .update(devices)
        .set({
          lastSeen: new Date(),
          pairedAt: new Date(),
        })
        .where(eq(devices.id, deviceId));

      log(`Marked device as paired: ${deviceId}`);
    } catch (error) {
      log('Failed to mark device as paired:', error);
      throw error;
    }
  }

  /**
   * Update device last seen
   */
  async updateDeviceLastSeen(deviceId: string) {
    try {
      await this.db
        .update(devices)
        .set({ lastSeen: new Date() })
        .where(eq(devices.id, deviceId));
    } catch (error) {
      log('Failed to update device last seen:', error);
    }
  }
}

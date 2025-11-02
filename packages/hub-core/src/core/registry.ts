/**
 * Registry - Device and entity CRUD operations for Hub V2
 * Handles device fingerprint deduplication and entity management
 */

import {
  credentials,
  devices,
  entities,
  homes,
  telemetryConfig,
} from '@cove/db/hub';
import type { HubDatabaseClient as DatabaseClient } from '@cove/db/hub/server';
import type { DeviceDescriptor, EntityDescriptor } from '@cove/drivers';
import { debug, error, info, warn } from '@cove/logger';
import { and, eq, isNull } from 'drizzle-orm';

const logDebug = debug('cove:hub:registry');
const logInfo = info('cove:hub:registry');
const logWarn = warn('cove:hub:registry');
const logError = error('cove:hub:registry');

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
        logDebug(`Using existing home: ${existingHome.id} (${name})`);
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

      logInfo(`Created new home: ${newHome[0].id} (${name})`);
      return newHome[0];
    } catch (err) {
      logError('Failed to get or create home:', err);
      throw err;
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
          logDebug(
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
          logDebug(
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

      logInfo(`Created new device: ${newDevice[0].id} (${deviceDesc.name})`);
      return newDevice[0];
    } catch (err) {
      logError('Failed to upsert device:', err);
      throw err;
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
        logDebug(
          `Using existing entity: ${existingEntity.id} (${entityDesc.kind}: ${entityDesc.id})`,
        );
        return existingEntity;
      }

      // Create new entity
      const newEntity = await this.db
        .insert(entities)
        .values({
          capability: entityDesc.capability,
          deviceClass: entityDesc.metadata?.deviceClass as string | undefined,
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

      logInfo(
        `Created new entity: ${newEntity[0].id} (${entityDesc.kind}: ${entityDesc.id})`,
      );
      return newEntity[0];
    } catch (err) {
      logError('Failed to upsert entity:', err);
      throw err;
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

      logDebug(`Stored credentials for device: ${deviceId} (${kind})`);
    } catch (err) {
      logError('Failed to store credentials:', err);
      throw err;
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
    } catch (err) {
      logWarn('Failed to get credentials:', err);
      return null;
    }
  }

  /**
   * Get devices by home ID
   * Note: entity state is excluded because it contains BLOB fields
   * that can't be serialized to JSON.
   */
  async getDevicesByHome(homeId: string) {
    try {
      const deviceList = await this.db.query.devices.findMany({
        where: eq(devices.homeId, homeId),
        with: {
          room: true,
        },
      });

      // Fetch entities for each device separately without state relation
      // to avoid BLOB serialization issues
      const devicesWithEntities = await Promise.all(
        deviceList.map(async (device) => {
          const deviceEntities = await this.db.query.entities.findMany({
            where: eq(entities.deviceId, device.id),
          });
          return {
            ...device,
            entities: deviceEntities,
          };
        }),
      );

      return devicesWithEntities;
    } catch (err) {
      logError('Failed to get devices by home:', err);
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
          // Note: state is excluded because it contains BLOB fields
          // that can't be serialized to JSON.
        },
      });
    } catch (err) {
      logError('Failed to get entities:', err);
      return [];
    }
  }

  /**
   * Get entity by ID
   * Note: state is excluded because it contains BLOB fields
   * that can't be serialized to JSON. Use StateStore.getEntityState() separately if needed.
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
          // Note: state is excluded because it contains BLOB fields
          // that can't be serialized to JSON.
        },
      });
    } catch (err) {
      logWarn('Failed to get entity:', err);
      return null;
    }
  }

  /**
   * Get device by ID
   * Note: credentials and entity state are excluded because they contain BLOB fields
   * that can't be serialized to JSON. Use getCredentials() separately if needed.
   */
  async getDevice(deviceId: string) {
    try {
      const device = await this.db.query.devices.findFirst({
        where: eq(devices.id, deviceId),
        with: {
          room: true,
        },
      });

      if (!device) {
        return null;
      }

      // Fetch entities separately without state relation to avoid BLOB serialization issues
      const deviceEntities = await this.db.query.entities.findMany({
        where: eq(entities.deviceId, deviceId),
      });

      return {
        ...device,
        entities: deviceEntities,
      };
    } catch (err) {
      logWarn('Failed to get device:', err);
      return null;
    }
  }

  /**
   * Mark device as paired
   */
  async markDevicePaired(deviceId: string) {
    try {
      // Check if device is already paired
      const device = await this.db.query.devices.findFirst({
        columns: { pairedAt: true },
        where: eq(devices.id, deviceId),
      });

      const isAlreadyPaired = device?.pairedAt !== null;

      await this.db
        .update(devices)
        .set({
          lastSeen: new Date(),
          pairedAt: new Date(),
        })
        .where(eq(devices.id, deviceId));

      // Only log as info if this is a new pairing, otherwise debug
      if (isAlreadyPaired) {
        logDebug(`Device already paired, updating lastSeen: ${deviceId}`);
      } else {
        logInfo(`Marked device as paired: ${deviceId}`);
      }
    } catch (err) {
      logError('Failed to mark device as paired:', err);
      throw err;
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
    } catch (err) {
      logWarn('Failed to update device last seen:', err);
    }
  }

  /**
   * Set telemetry configuration for an entity
   * @param entityId - Entity ID
   * @param field - Optional field name. If null, config applies to all fields
   * @param config - Telemetry configuration options
   */
  async setTelemetryConfig(
    entityId: string,
    field: string | null,
    config: {
      minimumInterval?: number | null; // Minimum time between recordings (ms)
      changeThreshold?: number | null; // Minimum change required to record (for numeric values)
    },
  ) {
    try {
      // Verify entity exists
      const entity = await this.db.query.entities.findFirst({
        where: eq(entities.id, entityId),
      });

      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      // Check if config already exists
      const existing = await this.db.query.telemetryConfig.findFirst({
        where: and(
          eq(telemetryConfig.entityId, entityId),
          field === null
            ? isNull(telemetryConfig.field)
            : eq(telemetryConfig.field, field),
        ),
      });

      if (existing) {
        // Update existing config
        await this.db
          .update(telemetryConfig)
          .set({
            changeThreshold: config.changeThreshold ?? null,
            minimumInterval: config.minimumInterval ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(telemetryConfig.entityId, entityId),
              field === null
                ? isNull(telemetryConfig.field)
                : eq(telemetryConfig.field, field),
            ),
          );
      } else {
        // Insert new config
        await this.db.insert(telemetryConfig).values({
          changeThreshold: config.changeThreshold ?? null,
          entityId,
          field: field ?? null,
          minimumInterval: config.minimumInterval ?? null,
          updatedAt: new Date(),
        });
      }

      logInfo(
        `Updated telemetry config for entity ${entityId}${field ? ` field ${field}` : ''}`,
      );
    } catch (err) {
      logError('Failed to set telemetry config:', err);
      throw err;
    }
  }

  /**
   * Get telemetry configuration for an entity
   * Returns field-specific config if available, otherwise entity-level config
   */
  async getTelemetryConfig(
    entityId: string,
    field?: string,
  ): Promise<{
    changeThreshold: number | null;
    minimumInterval: number | null;
  } | null> {
    try {
      // First try to get field-specific config if field is provided
      if (field) {
        const fieldConfig = await this.db.query.telemetryConfig.findFirst({
          where: and(
            eq(telemetryConfig.entityId, entityId),
            eq(telemetryConfig.field, field),
          ),
        });

        if (fieldConfig) {
          return {
            changeThreshold: fieldConfig.changeThreshold ?? null,
            minimumInterval: fieldConfig.minimumInterval ?? null,
          };
        }
      }

      // Fall back to entity-level config (field is null)
      const entityConfig = await this.db.query.telemetryConfig.findFirst({
        where: and(
          eq(telemetryConfig.entityId, entityId),
          isNull(telemetryConfig.field),
        ),
      });

      if (entityConfig) {
        return {
          changeThreshold: entityConfig.changeThreshold ?? null,
          minimumInterval: entityConfig.minimumInterval ?? null,
        };
      }

      return null;
    } catch (err) {
      logWarn('Failed to get telemetry config:', err);
      return null;
    }
  }

  /**
   * Remove telemetry configuration for an entity
   */
  async removeTelemetryConfig(entityId: string, field?: string) {
    try {
      const where = field
        ? and(
            eq(telemetryConfig.entityId, entityId),
            eq(telemetryConfig.field, field),
          )
        : eq(telemetryConfig.entityId, entityId);

      await this.db.delete(telemetryConfig).where(where);

      logInfo(
        `Removed telemetry config for entity ${entityId}${field ? ` field ${field}` : ''}`,
      );
    } catch (err) {
      logError('Failed to remove telemetry config:', err);
      throw err;
    }
  }
}

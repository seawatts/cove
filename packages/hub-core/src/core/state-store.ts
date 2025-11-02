/**
 * StateStore - Entity state and telemetry writes for Hub V2
 * Handles entity_state snapshots and telemetry batching
 */

import { entityState, telemetry } from '@cove/db/hub';
import type { HubDatabaseClient as DatabaseClient } from '@cove/db/hub/server';
import { debug, error, info } from '@cove/logger';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { AlertService } from './alert-service';
import type { EventBus } from './event-bus';
import type { Registry } from './registry';

const logDebug = debug('cove:hub-v2:state-store');
const logInfo = info('cove:hub-v2:state-store');
const logError = error('cove:hub-v2:state-store');

export interface StateStoreOptions {
  db: DatabaseClient;
  eventBus: EventBus;
  registry?: Registry; // Optional registry for telemetry config
  alertService?: AlertService; // Optional alert service for alert evaluation
}

interface TelemetryBatchItem {
  entityId: string;
  homeId: string;
  field: string;
  value: number | string | boolean;
  unit?: string;
  timestamp: Date;
}

/**
 * StateStore class
 */
export class StateStore {
  private db: DatabaseClient;
  private eventBus: EventBus;
  private registry?: Registry;
  private alertService?: AlertService;
  private telemetryQueue: TelemetryBatchItem[] = [];
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private readonly BATCH_SIZE = 500;
  private readonly BATCH_INTERVAL = 5000; // ms - increased to 5 seconds to reduce write frequency
  // Deduplication: track last telemetry value to avoid storing identical values
  private lastTelemetryValue = new Map<
    string,
    { value: number | string | boolean; timestamp: Date }
  >();
  private readonly DEFAULT_TELEMETRY_DEDUP_WINDOW = 30000; // ms - default: ignore duplicate values within 30 seconds
  // Cache telemetry configs to avoid frequent DB lookups
  private telemetryConfigCache = new Map<
    string,
    {
      changeThreshold: number | null;
      minimumInterval: number | null;
      cachedAt: Date;
    }
  >();
  private readonly CONFIG_CACHE_TTL = 60000; // Cache configs for 1 minute

  constructor(options: StateStoreOptions) {
    this.db = options.db;
    this.eventBus = options.eventBus;
    this.registry = options.registry;
    this.alertService = options.alertService;
  }

  /**
   * Start telemetry batching
   */
  startTelemetryBatching() {
    if (this.telemetryTimer) return;

    this.telemetryTimer = setInterval(async () => {
      if (this.telemetryQueue.length === 0) return;

      const batch = this.telemetryQueue.splice(0, this.BATCH_SIZE);
      await this.flushTelemetryBatch(batch);
    }, this.BATCH_INTERVAL);

    logInfo('Started telemetry batching');
  }

  /**
   * Stop telemetry batching
   */
  stopTelemetryBatching() {
    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }

    // Flush remaining items
    if (this.telemetryQueue.length > 0) {
      this.flushTelemetryBatch(this.telemetryQueue.splice(0));
    }

    logInfo('Stopped telemetry batching');
  }

  /**
   * Flush telemetry batch to database
   */
  private async flushTelemetryBatch(batch: TelemetryBatchItem[]) {
    if (batch.length === 0) return;

    try {
      const valuesToInsert = batch
        .filter(
          (item): item is TelemetryBatchItem & { value: number } =>
            typeof item.value === 'number',
        )
        .map((item) => ({
          entityId: item.entityId,
          field: item.field,
          homeId: item.homeId,
          ts: item.timestamp,
          unit: item.unit,
          value: item.value,
        }));

      await this.db.insert(telemetry).values(valuesToInsert);

      // Only log if batch is significant to reduce noise
      if (batch.length >= 10) {
        logInfo(`Flushed ${batch.length} telemetry records`);
      }
    } catch (err) {
      logError('Failed to flush telemetry batch:', err);
      logDebug('Batch items:', batch);
    }
  }

  /**
   * Write entity state snapshot (upsert, last-write-wins)
   */
  async writeEntityState(entityId: string, state: Record<string, unknown>) {
    try {
      await this.db
        .insert(entityState)
        .values({
          entityId,
          state,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            state,
            updatedAt: new Date(),
          },
          target: entityState.entityId,
        });

      logDebug(`Updated entity state: ${entityId}`);
    } catch (err) {
      logError('Failed to write entity state:', err);
      throw err;
    }
  }

  /**
   * Get telemetry config for an entity (with caching)
   */
  private async getTelemetryConfigCached(
    entityId: string,
    field: string,
  ): Promise<{
    changeThreshold: number | null;
    minimumInterval: number | null;
  } | null> {
    const cacheKey = `${entityId}:${field}`;
    const cached = this.telemetryConfigCache.get(cacheKey);
    const now = new Date();

    // Return cached config if still valid
    if (cached) {
      const cacheAge = now.getTime() - cached.cachedAt.getTime();
      if (cacheAge < this.CONFIG_CACHE_TTL) {
        return {
          changeThreshold: cached.changeThreshold,
          minimumInterval: cached.minimumInterval,
        };
      }
    }

    // Fetch fresh config from registry
    if (!this.registry) {
      return null;
    }

    try {
      const config = await this.registry.getTelemetryConfig(entityId, field);
      if (config) {
        // Update cache
        this.telemetryConfigCache.set(cacheKey, {
          cachedAt: now,
          changeThreshold: config.changeThreshold,
          minimumInterval: config.minimumInterval,
        });
      }
      return config;
    } catch (err) {
      logDebug('Failed to get telemetry config:', err);
      return null;
    }
  }

  /**
   * Append telemetry record (batched)
   * Uses per-entity telemetry configuration for frequency and sensitivity
   */
  async appendTelemetry(
    entityId: string,
    homeId: string,
    field: string,
    value: number | string | boolean,
    unit?: string,
    timestamp?: Date,
  ) {
    const now = timestamp || new Date();
    const telemetryKey = `${entityId}:${field}`;

    // Get telemetry config for this entity/field
    const config = await this.getTelemetryConfigCached(entityId, field);
    const minimumInterval =
      config?.minimumInterval ?? this.DEFAULT_TELEMETRY_DEDUP_WINDOW;
    const changeThreshold = config?.changeThreshold ?? null;

    // Check last recorded value
    const lastValue = this.lastTelemetryValue.get(telemetryKey);
    if (lastValue) {
      const timeSinceLastUpdate = now.getTime() - lastValue.timestamp.getTime();

      // Check minimum interval (frequency control)
      if (timeSinceLastUpdate < minimumInterval) {
        // Too soon since last recording - check if value changed enough
        if (typeof value === 'number' && typeof lastValue.value === 'number') {
          // Apply change threshold (sensitivity control)
          if (changeThreshold !== null) {
            const change = Math.abs(value - lastValue.value);
            if (change < changeThreshold) {
              // Change is too small, skip recording
              return;
            }
          } else {
            // No change threshold set, skip if exact match
            if (value === lastValue.value) {
              return;
            }
          }
        } else {
          // Non-numeric or different type - skip if exact match
          if (value === lastValue.value) {
            return;
          }
        }
      } else {
        // Enough time has passed - check if value changed
        if (typeof value === 'number' && typeof lastValue.value === 'number') {
          // Apply change threshold if configured
          if (changeThreshold !== null) {
            const change = Math.abs(value - lastValue.value);
            if (change < changeThreshold) {
              // Change is too small, skip recording
              return;
            }
          } else if (value === lastValue.value) {
            // No change threshold, exact match means skip
            return;
          }
        } else if (value === lastValue.value) {
          // Non-numeric exact match, skip
          return;
        }
      }
    }

    // Update last seen value
    this.lastTelemetryValue.set(telemetryKey, { timestamp: now, value });

    // Only store numeric values (telemetry table schema restriction)
    if (typeof value !== 'number') {
      return;
    }

    this.telemetryQueue.push({
      entityId,
      field,
      homeId,
      timestamp: now,
      unit,
      value,
    });

    // Publish telemetry event
    this.eventBus.publishTelemetry({
      entityId,
      field,
      unit,
      value,
    });

    // Evaluate alerts for this telemetry value
    if (this.alertService) {
      try {
        await this.alertService.evaluateAlerts(entityId, field, value, now);
      } catch (err) {
        // Don't fail telemetry recording if alert evaluation fails
        logError('Failed to evaluate alerts:', err);
      }
    }
  }

  /**
   * Get current entity state
   */
  async getEntityState(entityId: string) {
    try {
      return await this.db.query.entityState.findFirst({
        where: eq(entityState.entityId, entityId),
      });
    } catch (err) {
      logError('Failed to get entity state:', err);
      return null;
    }
  }

  /**
   * Get entity telemetry history
   */
  async getEntityTelemetry(
    entityId: string,
    options: {
      field?: string;
      since?: Date;
      limit?: number;
    } = {},
  ) {
    try {
      const conditions = [eq(telemetry.entityId, entityId)];

      if (options.field) {
        conditions.push(eq(telemetry.field, options.field));
      }

      if (options.since) {
        conditions.push(gte(telemetry.ts, options.since));
      }

      const where = conditions.length > 1 ? and(...conditions) : conditions[0];

      return await this.db.query.telemetry.findMany({
        limit: options.limit || 100,
        orderBy: [desc(telemetry.ts)],
        where,
      });
    } catch (err) {
      logError('Failed to get entity telemetry:', err);
      return [];
    }
  }

  /**
   * Get home telemetry (for dashboard/analytics)
   */
  async getHomeTelemetry(
    homeId: string,
    options: {
      field?: string;
      since?: Date;
      limit?: number;
    } = {},
  ) {
    try {
      const conditions = [eq(telemetry.homeId, homeId)];

      if (options.field) {
        conditions.push(eq(telemetry.field, options.field));
      }

      if (options.since) {
        conditions.push(gte(telemetry.ts, options.since));
      }

      const where = conditions.length > 1 ? and(...conditions) : conditions[0];

      return await this.db.query.telemetry.findMany({
        limit: options.limit || 1000,
        orderBy: [desc(telemetry.ts)],
        where,
        with: {
          entity: true,
        },
      });
    } catch (err) {
      logError('Failed to get home telemetry:', err);
      return [];
    }
  }

  /**
   * Get aggregated entity telemetry data for charts/graphs
   * Aggregates telemetry by time buckets (mean, min, max)
   */
  async getEntityTelemetryAggregated(
    entityId: string,
    options: {
      field?: string;
      timeRange?: '1h' | '24h' | '7d' | '30d' | '90d';
    } = {},
  ) {
    try {
      const { field, timeRange = '24h' } = options;

      // Calculate time range and bucket size
      const now = new Date();
      let since: Date;
      let bucketSeconds: number;

      switch (timeRange) {
        case '1h':
          since = new Date(now.getTime() - 60 * 60 * 1000);
          bucketSeconds = 5 * 60; // 5 minutes (12 points)
          break;
        case '24h':
          since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          bucketSeconds = 60 * 60; // 1 hour (24 points) - optimized from 30 min
          break;
        case '7d':
          since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          bucketSeconds = 8 * 60 * 60; // 8 hours (21 points) - optimized from 6 hours
          break;
        case '30d':
          since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          bucketSeconds = 24 * 60 * 60; // 1 day (30 points)
          break;
        case '90d':
          since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          bucketSeconds = 2 * 24 * 60 * 60; // 2 days (45 points) - optimized from 1 day
          break;
        default:
          since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          bucketSeconds = 60 * 60; // 1 hour
      }

      const conditions = [
        eq(telemetry.entityId, entityId),
        gte(telemetry.ts, since),
      ];

      if (field) {
        conditions.push(eq(telemetry.field, field));
      }

      const where = conditions.length > 1 ? and(...conditions) : conditions[0];

      // Get all telemetry data for the time range
      const telemetryData = await this.db.query.telemetry.findMany({
        orderBy: [desc(telemetry.ts)],
        where,
      });

      // Aggregate by time buckets in memory
      // Using optimized bucket sizes to reduce data points
      const timeBucketMs = bucketSeconds * 1000;
      const aggregated = new Map<
        number,
        { values: number[]; timestamps: Date[] }
      >();

      for (const record of telemetryData) {
        const bucketTime =
          Math.floor(record.ts.getTime() / timeBucketMs) * timeBucketMs;
        const value =
          typeof record.value === 'number'
            ? record.value
            : Number(record.value);
        const numericValue = Number.isNaN(value) ? 0 : value;

        if (!aggregated.has(bucketTime)) {
          aggregated.set(bucketTime, { timestamps: [], values: [] });
        }

        const bucket = aggregated.get(bucketTime);
        if (!bucket) continue;
        bucket.values.push(numericValue);
        bucket.timestamps.push(record.ts);
      }

      // Convert to array format expected by frontend
      return Array.from(aggregated.entries())
        .map(([timestamp, bucket]) => ({
          max: bucket.values.length > 0 ? Math.max(...bucket.values) : null,
          mean:
            bucket.values.length > 0
              ? bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length
              : null,
          min: bucket.values.length > 0 ? Math.min(...bucket.values) : null,
          timestamp,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (err) {
      logError('Failed to get aggregated telemetry:', err);
      return [];
    }
  }

  /**
   * Get telemetry queue size
   */
  getTelemetryQueueSize(): number {
    return this.telemetryQueue.length;
  }

  /**
   * Clear all state and telemetry (useful for testing)
   */
  async clear() {
    try {
      await this.db.delete(entityState);
      await this.db.delete(telemetry);
      this.telemetryQueue.length = 0;
      logInfo('Cleared all state and telemetry');
    } catch (err) {
      logError('Failed to clear state and telemetry:', err);
      throw err;
    }
  }
}

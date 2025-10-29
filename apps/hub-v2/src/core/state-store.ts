/**
 * StateStore - Entity state and telemetry writes for Hub V2
 * Handles entity_state snapshots and telemetry batching
 */

import { debug } from '@cove/logger';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { DatabaseClient } from '../db';
import { entityState, telemetry } from '../db';
import type { EventBus } from './event-bus';

const log = debug('cove:hub-v2:state-store');

export interface StateStoreOptions {
  db: DatabaseClient;
  eventBus: EventBus;
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
  private telemetryQueue: TelemetryBatchItem[] = [];
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private readonly BATCH_SIZE = 500;
  private readonly BATCH_INTERVAL = 5000; // ms - increased to 5 seconds to reduce write frequency
  // Deduplication: track last telemetry value to avoid storing identical values
  private lastTelemetryValue = new Map<
    string,
    { value: number | string | boolean; timestamp: Date }
  >();
  private readonly TELEMETRY_DEDUP_WINDOW = 30000; // ms - ignore duplicate values within 30 seconds

  constructor(options: StateStoreOptions) {
    this.db = options.db;
    this.eventBus = options.eventBus;
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

    log('Started telemetry batching');
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

    log('Stopped telemetry batching');
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
        log(`Flushed ${batch.length} telemetry records`);
      }
    } catch (error) {
      log('Failed to flush telemetry batch:', error);
      log('Batch items:', batch);
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

      log(`Updated entity state: ${entityId}`);
    } catch (error) {
      log('Failed to write entity state:', error);
      throw error;
    }
  }

  /**
   * Append telemetry record (batched)
   */
  appendTelemetry(
    entityId: string,
    homeId: string,
    field: string,
    value: number | string | boolean,
    unit?: string,
    timestamp?: Date,
  ) {
    const now = timestamp || new Date();
    const telemetryKey = `${entityId}:${field}`;

    // Deduplication: Check if we've seen this exact value recently
    const lastValue = this.lastTelemetryValue.get(telemetryKey);
    if (lastValue) {
      const timeSinceLastUpdate = now.getTime() - lastValue.timestamp.getTime();
      if (
        lastValue.value === value &&
        timeSinceLastUpdate < this.TELEMETRY_DEDUP_WINDOW
      ) {
        // Skip duplicate value within dedup window
        return;
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
  }

  /**
   * Get current entity state
   */
  async getEntityState(entityId: string) {
    try {
      return await this.db.query.entityState.findFirst({
        where: eq(entityState.entityId, entityId),
      });
    } catch (error) {
      log('Failed to get entity state:', error);
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
    } catch (error) {
      log('Failed to get entity telemetry:', error);
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
    } catch (error) {
      log('Failed to get home telemetry:', error);
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

      // Calculate time range
      const now = new Date();
      let since: Date;
      let timeBucketMs: number;

      switch (timeRange) {
        case '1h':
          since = new Date(now.getTime() - 60 * 60 * 1000);
          timeBucketMs = 5 * 60 * 1000; // 5 minutes
          break;
        case '24h':
          since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          timeBucketMs = 30 * 60 * 1000; // 30 minutes
          break;
        case '7d':
          since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          timeBucketMs = 6 * 60 * 60 * 1000; // 6 hours
          break;
        case '30d':
          since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          timeBucketMs = 24 * 60 * 60 * 1000; // 1 day
          break;
        case '90d':
          since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          timeBucketMs = 24 * 60 * 60 * 1000; // 1 day
          break;
        default:
          since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          timeBucketMs = 30 * 60 * 1000; // 30 minutes
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

      // Aggregate by time buckets
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
    } catch (error) {
      log('Failed to get aggregated telemetry:', error);
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
      log('Cleared all state and telemetry');
    } catch (error) {
      log('Failed to clear state and telemetry:', error);
      throw error;
    }
  }
}

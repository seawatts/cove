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
  private readonly BATCH_INTERVAL = 250; // ms

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
      await this.db.insert(telemetry).values(
        batch.map((item) => ({
          entityId: item.entityId,
          field: item.field,
          homeId: item.homeId,
          ts: item.timestamp,
          unit: item.unit,
          value: typeof item.value === 'number' ? item.value : null,
        })),
      );

      log(`Flushed ${batch.length} telemetry records`);
    } catch (error) {
      log('Failed to flush telemetry batch:', error);
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
    this.telemetryQueue.push({
      entityId,
      field,
      homeId,
      timestamp: timestamp || new Date(),
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

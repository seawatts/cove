/**
 * Graph Queries
 * Generic queries for chart data visualization in the web app
 *
 * Uses standard PostgreSQL queries with in-memory aggregation for time-series data.
 * Suitable for moderate data volumes with efficient time-based queries.
 */

import { EntityKind } from '@cove/types';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from './client';
import { devices, entities, entityStateHistories } from './schema';

// ===================================
// Types
// ===================================

export type TimeRange = '1h' | '24h' | '7d' | '30d' | '90d';
export type TimeBucket = '1min' | '5min' | '10min' | '30min' | '1hour' | '1day';

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface AggregatedDataPoint {
  timestamp: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  last: string | null;
}

export interface MultiEntityDataPoint {
  timestamp: number;
  [entityId: string]: number | string;
}

// ===================================
// Utility Functions
// ===================================

function getTimeRangeDates(timeRange: TimeRange) {
  const now = new Date();
  const end = now;
  let start: Date;

  switch (timeRange) {
    case '1h':
      start = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  return { end, start };
}

function getOptimalTimeBucket(timeRange: TimeRange): TimeBucket {
  switch (timeRange) {
    case '1h':
      return '1min';
    case '24h':
      return '5min';
    case '7d':
      return '30min';
    case '30d':
      return '1hour';
    case '90d':
      return '1day';
    default:
      return '5min';
  }
}

function getTimeBucketMs(timeBucket: TimeBucket): number {
  switch (timeBucket) {
    case '1min':
      return 60 * 1000;
    case '5min':
      return 5 * 60 * 1000;
    case '10min':
      return 10 * 60 * 1000;
    case '30min':
      return 30 * 60 * 1000;
    case '1hour':
      return 60 * 60 * 1000;
    case '1day':
      return 24 * 60 * 60 * 1000;
    default:
      return 5 * 60 * 1000;
  }
}

// ===================================
// Single Entity Queries
// ===================================

/**
 * Get aggregated sensor data for a single entity
 * Uses standard PostgreSQL queries with in-memory aggregation
 */
export async function getEntityAggregatedData(
  entityId: string,
  timeRange: TimeRange = '24h',
  timeBucket?: TimeBucket,
): Promise<AggregatedDataPoint[]> {
  const { start, end } = getTimeRangeDates(timeRange);
  const bucket = timeBucket || getOptimalTimeBucket(timeRange);

  const result = await db
    .select({
      state: entityStateHistories.state,
      ts: entityStateHistories.ts,
    })
    .from(entityStateHistories)
    .where(
      and(
        eq(entityStateHistories.entityId, entityId),
        gte(entityStateHistories.ts, start),
        lte(entityStateHistories.ts, end),
      ),
    )
    .orderBy(asc(entityStateHistories.ts));

  // Simple aggregation by time bucket
  const timeBucketMs = getTimeBucketMs(bucket);
  const aggregated = new Map<number, { values: number[]; states: string[] }>();

  result.forEach((row) => {
    const bucketTime =
      Math.floor(row.ts.getTime() / timeBucketMs) * timeBucketMs;
    const value = typeof row.state === 'number' ? row.state : Number(row.state);
    const numericValue = Number.isNaN(value) ? 0 : value;

    if (!aggregated.has(bucketTime)) {
      aggregated.set(bucketTime, { states: [], values: [] });
    }

    const bucket = aggregated.get(bucketTime);
    if (!bucket) return;
    bucket.values.push(numericValue);
    bucket.states.push(row.state);
  });

  return Array.from(aggregated.entries())
    .map(([timestamp, bucket]) => ({
      last: bucket.states.at(-1) ?? '',
      max: Math.max(...bucket.values),
      mean: bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length,
      min: Math.min(...bucket.values),
      timestamp,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get raw state history for a single entity
 */
export async function getEntityRawHistory(
  entityId: string,
  timeRange: TimeRange = '24h',
  limit = 1000,
): Promise<ChartDataPoint[]> {
  const { start, end } = getTimeRangeDates(timeRange);

  const result = await db
    .select({
      state: entityStateHistories.state,
      ts: entityStateHistories.ts,
    })
    .from(entityStateHistories)
    .where(
      and(
        eq(entityStateHistories.entityId, entityId),
        gte(entityStateHistories.ts, start),
        lte(entityStateHistories.ts, end),
      ),
    )
    .orderBy(asc(entityStateHistories.ts))
    .limit(limit);

  return result.map((row) => {
    const value = typeof row.state === 'number' ? row.state : Number(row.state);
    return {
      timestamp: row.ts.getTime(),
      value: Number.isNaN(value) ? 0 : value,
    };
  });
}

// ===================================
// Multi-Entity Queries
// ===================================

/**
 * Get aggregated data for multiple entities for comparison charts
 */
export async function getMultiEntityAggregatedData(
  entityIds: string[],
  timeRange: TimeRange = '24h',
): Promise<MultiEntityDataPoint[]> {
  const { start, end } = getTimeRangeDates(timeRange);

  // Get data for each entity separately and combine
  const entityDataPromises = entityIds.map(async (entityId) => {
    const result = await db
      .select({
        state: entityStateHistories.state,
        ts: entityStateHistories.ts,
      })
      .from(entityStateHistories)
      .where(
        and(
          eq(entityStateHistories.entityId, entityId),
          gte(entityStateHistories.ts, start),
          lte(entityStateHistories.ts, end),
        ),
      )
      .orderBy(asc(entityStateHistories.ts));

    return { data: result, entityId };
  });

  const entityDataResults = await Promise.all(entityDataPromises);

  // Combine data points by timestamp
  const timestampMap = new Map<number, MultiEntityDataPoint>();

  entityDataResults.forEach(({ entityId, data }) => {
    data.forEach((row) => {
      const timestamp = row.ts.getTime();
      const value =
        typeof row.state === 'number' ? row.state : Number(row.state);
      const numericValue = Number.isNaN(value) ? 0 : value;

      if (!timestampMap.has(timestamp)) {
        timestampMap.set(timestamp, { timestamp });
      }

      const dataPoint = timestampMap.get(timestamp);
      if (!dataPoint) return;
      dataPoint[entityId] = numericValue;
    });
  });

  return Array.from(timestampMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp,
  );
}

// ===================================
// Room-Level Aggregation
// ===================================

/**
 * Get aggregated sensor data for all entities in a room
 */
export async function getRoomAggregatedData(
  roomId: string,
  entityKind: EntityKind, // e.g., 'sensor', 'light', etc.
  timeRange: TimeRange = '24h',
  timeBucket?: TimeBucket,
): Promise<AggregatedDataPoint[]> {
  const { start, end } = getTimeRangeDates(timeRange);
  const bucket = timeBucket || getOptimalTimeBucket(timeRange);

  // Get all entities in the room of the specified kind
  const roomEntities = await db
    .select({
      entityId: entities.id,
    })
    .from(entities)
    .innerJoin(devices, eq(entities.deviceId, devices.id))
    .where(and(eq(devices.roomId, roomId), eq(entities.kind, entityKind)));

  if (roomEntities.length === 0) {
    return [];
  }

  const entityIds = roomEntities.map((e) => e.entityId);

  // Get state history for all entities
  const result = await db
    .select({
      state: entityStateHistories.state,
      ts: entityStateHistories.ts,
    })
    .from(entityStateHistories)
    .where(
      and(
        sql`${entityStateHistories.entityId} = ANY(${entityIds})`,
        gte(entityStateHistories.ts, start),
        lte(entityStateHistories.ts, end),
      ),
    )
    .orderBy(asc(entityStateHistories.ts));

  // Simple aggregation by time bucket
  const timeBucketMs = getTimeBucketMs(bucket);
  const aggregated = new Map<number, { values: number[]; states: string[] }>();

  result.forEach((row) => {
    const bucketTime =
      Math.floor(row.ts.getTime() / timeBucketMs) * timeBucketMs;
    const value = typeof row.state === 'number' ? row.state : Number(row.state);
    const numericValue = Number.isNaN(value) ? 0 : value;

    if (!aggregated.has(bucketTime)) {
      aggregated.set(bucketTime, { states: [], values: [] });
    }

    const bucket = aggregated.get(bucketTime);
    if (!bucket) return;
    bucket.values.push(numericValue);
    bucket.states.push(row.state);
  });

  return Array.from(aggregated.entries())
    .map(([timestamp, bucket]) => ({
      last: bucket.states.at(-1) ?? '',
      max: Math.max(...bucket.values),
      mean: bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length,
      min: Math.min(...bucket.values),
      timestamp,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ===================================
// Home-Level Aggregation
// ===================================

/**
 * Get aggregated sensor data for all entities of a specific kind in a home
 */
export async function getHomeAggregatedData(
  homeId: string,
  entityKind: EntityKind,
  timeRange: TimeRange = '24h',
  timeBucket?: TimeBucket,
): Promise<AggregatedDataPoint[]> {
  const { start, end } = getTimeRangeDates(timeRange);
  const bucket = timeBucket || getOptimalTimeBucket(timeRange);

  // Get all entities in the home of the specified kind
  const homeEntities = await db
    .select({
      entityId: entities.id,
    })
    .from(entities)
    .innerJoin(devices, eq(entities.deviceId, devices.id))
    .where(and(eq(devices.homeId, homeId), eq(entities.kind, entityKind)));

  if (homeEntities.length === 0) {
    return [];
  }

  const entityIds = homeEntities.map((e) => e.entityId);

  // Get state history for all entities
  const result = await db
    .select({
      state: entityStateHistories.state,
      ts: entityStateHistories.ts,
    })
    .from(entityStateHistories)
    .where(
      and(
        sql`${entityStateHistories.entityId} = ANY(${entityIds})`,
        gte(entityStateHistories.ts, start),
        lte(entityStateHistories.ts, end),
      ),
    )
    .orderBy(asc(entityStateHistories.ts));

  // Simple aggregation by time bucket
  const timeBucketMs = getTimeBucketMs(bucket);
  const aggregated = new Map<number, { values: number[]; states: string[] }>();

  result.forEach((row) => {
    const bucketTime =
      Math.floor(row.ts.getTime() / timeBucketMs) * timeBucketMs;
    const value = typeof row.state === 'number' ? row.state : Number(row.state);
    const numericValue = Number.isNaN(value) ? 0 : value;

    if (!aggregated.has(bucketTime)) {
      aggregated.set(bucketTime, { states: [], values: [] });
    }

    const bucket = aggregated.get(bucketTime);
    if (!bucket) return;
    bucket.values.push(numericValue);
    bucket.states.push(row.state);
  });

  return Array.from(aggregated.entries())
    .map(([timestamp, bucket]) => ({
      last: bucket.states.at(-1) ?? '',
      max: Math.max(...bucket.values),
      mean: bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length,
      min: Math.min(...bucket.values),
      timestamp,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ===================================
// Device-Level Queries
// ===================================

/**
 * Get all entities for a device with their current states
 */
export async function getDeviceEntities(deviceId: string) {
  const result = await db
    .select({
      capabilities: entities.capabilities,
      currentState: {
        attrs: entityStateHistories.attrs,
        state: entityStateHistories.state,
        ts: entityStateHistories.ts,
      },
      deviceClass: entities.deviceClass,
      entityId: entities.id,
      key: entities.key,
      kind: entities.kind,
    })
    .from(entities)
    .leftJoin(
      entityStateHistories,
      and(
        eq(entityStateHistories.entityId, entities.id),
        eq(
          entityStateHistories.ts,
          sql`(
          SELECT MAX(ts)
          FROM "entityStateHistories"
          WHERE "entityId" = ${entities.id}
        )`,
        ),
      ),
    )
    .where(eq(entities.deviceId, deviceId))
    .orderBy(entities.key);

  return result;
}

// ===================================
// Dashboard Overview Queries
// ===================================

/**
 * Get summary statistics for all sensors in a home
 */
export async function getHomeSensorSummary(homeId: string) {
  // Get all sensor entities in the home
  const sensorEntities = await db
    .select({
      entityId: entities.id,
      kind: entities.kind,
    })
    .from(entities)
    .innerJoin(devices, eq(entities.deviceId, devices.id))
    .where(
      and(eq(devices.homeId, homeId), eq(entities.kind, EntityKind.Sensor)),
    );

  if (sensorEntities.length === 0) {
    return [];
  }

  const entityIds = sensorEntities.map((e) => e.entityId);

  // Get latest state for each entity
  const latestStates = await db
    .select({
      entityId: entityStateHistories.entityId,
      state: entityStateHistories.state,
    })
    .from(entityStateHistories)
    .where(sql`${entityStateHistories.entityId} = ANY(${entityIds})`)
    .orderBy(desc(entityStateHistories.ts));

  // Group by entity kind and calculate statistics
  const kindStats = new Map<string, { count: number; values: number[] }>();

  sensorEntities.forEach((entity) => {
    if (!kindStats.has(entity.kind)) {
      kindStats.set(entity.kind, { count: 0, values: [] });
    }
    const stats = kindStats.get(entity.kind);
    if (stats) stats.count++;
  });

  latestStates.forEach((state) => {
    const value =
      typeof state.state === 'number' ? state.state : Number(state.state);
    if (!Number.isNaN(value)) {
      const entity = sensorEntities.find((e) => e.entityId === state.entityId);
      if (entity) {
        const stats = kindStats.get(entity.kind);
        if (stats) {
          stats.values.push(value);
        }
      }
    }
  });

  return Array.from(kindStats.entries()).map(([kind, stats]) => ({
    avg_value:
      stats.values.length > 0
        ? stats.values.reduce((a, b) => a + b, 0) / stats.values.length
        : null,
    entity_count: stats.count,
    kind,
    max_value: stats.values.length > 0 ? Math.max(...stats.values) : null,
    min_value: stats.values.length > 0 ? Math.min(...stats.values) : null,
  }));
}

/**
 * Get recent activity summary for a home (last 24 hours)
 */
export async function getHomeActivitySummary(homeId: string) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get state changes in the last 24 hours
  const result = await db
    .select({
      entityId: entityStateHistories.entityId,
      ts: entityStateHistories.ts,
    })
    .from(entityStateHistories)
    .innerJoin(entities, eq(entityStateHistories.entityId, entities.id))
    .innerJoin(devices, eq(entities.deviceId, devices.id))
    .where(
      and(eq(devices.homeId, homeId), gte(entityStateHistories.ts, oneDayAgo)),
    )
    .orderBy(desc(entityStateHistories.ts));

  // Group by hour
  const hourlyActivity = new Map<
    number,
    { stateChanges: number; activeEntities: Set<string> }
  >();

  result.forEach((row) => {
    const hour =
      Math.floor(row.ts.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000);

    if (!hourlyActivity.has(hour)) {
      hourlyActivity.set(hour, { activeEntities: new Set(), stateChanges: 0 });
    }

    const activity = hourlyActivity.get(hour);
    if (!activity) return;
    activity.stateChanges++;
    activity.activeEntities.add(row.entityId);
  });

  return Array.from(hourlyActivity.entries())
    .map(([hour, activity]) => ({
      active_entities: activity.activeEntities.size,
      hour: new Date(hour),
      state_changes: activity.stateChanges,
    }))
    .sort((a, b) => b.hour.getTime() - a.hour.getTime());
}

// ===================================
// Export all functions
// ===================================

export const graphQueries = {
  // Device queries
  getDeviceEntities,
  // Single entity queries
  getEntityAggregatedData,
  getEntityRawHistory,
  getHomeActivitySummary,

  // Home-level queries
  getHomeAggregatedData,
  getHomeSensorSummary,

  // Multi-entity queries
  getMultiEntityAggregatedData,
  getOptimalTimeBucket,

  // Room-level queries
  getRoomAggregatedData,
  getTimeBucketMs,

  // Utility functions
  getTimeRangeDates,
};

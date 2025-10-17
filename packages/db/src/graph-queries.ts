/**
 * Graph Queries
 * Generic queries for chart data visualization in the web app
 *
 * Current State:
 * - TimescaleDB hypertable is enabled for entityStateHistory (automatic time-based partitioning)
 * - Continuous aggregates are commented out in migration due to Apache license limitations
 * - All queries gracefully fall back to raw aggregation when continuous aggregates aren't available
 * - For production deployment with TimescaleDB Community License, uncomment continuous aggregates in migration
 *
 * Performance:
 * - Hypertable provides automatic partitioning for efficient time-series queries
 * - Fallback queries use in-memory aggregation (suitable for moderate data volumes)
 * - With Community License, continuous aggregates would provide pre-computed rollups for maximum performance
 */

import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from './client';
import { device, entity, entityStateHistory } from './schema';

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

/**
 * Helper function to safely extract rows from database execute result
 */
function getRowsFromResult(result: unknown): Record<string, unknown>[] {
	// Handle different database client return types
	if (result && typeof result === 'object') {
		if (
			'rows' in result &&
			Array.isArray((result as Record<string, unknown>).rows)
		) {
			return (result as Record<string, unknown>).rows as Record<
				string,
				unknown
			>[];
		}
		if (Array.isArray(result)) {
			return result as Record<string, unknown>[];
		}
	}
	return [];
}

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

function getContinuousAggregateTable(timeBucket: TimeBucket): string {
	// Note: Continuous aggregates are commented out in migration due to Apache license
	// These would be available with TimescaleDB Community License
	switch (timeBucket) {
		case '1min':
			return 'entity_state_1min';
		case '5min':
			return 'entity_state_5min';
		case '10min':
			return 'entity_state_5min'; // Fallback to 5min
		case '30min':
			return 'entity_state_5min'; // Fallback to 5min
		case '1hour':
			return 'entity_state_hourly';
		case '1day':
			return 'entity_state_daily';
		default:
			return 'entity_state_5min';
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
 * Get aggregated sensor data for a single entity using TimescaleDB continuous aggregates
 * This is the most efficient way to query time-series data for charts
 */
export async function getEntityAggregatedData(
	entityId: string,
	timeRange: TimeRange = '24h',
	timeBucket?: TimeBucket,
): Promise<AggregatedDataPoint[]> {
	const { start, end } = getTimeRangeDates(timeRange);

	const bucket = timeBucket || getOptimalTimeBucket(timeRange);
	const aggregateTable = getContinuousAggregateTable(bucket);

	// Determine the time column name based on bucket
	const timeColumn =
		bucket === '1day'
			? 'day_start'
			: bucket === '1hour'
				? 'hour_start'
				: 'minute_start';

	try {
		// Use TimescaleDB continuous aggregate for efficient querying
		const result = await db.execute(sql`
			SELECT
				EXTRACT(EPOCH FROM ${sql.identifier(timeColumn)}) * 1000 as timestamp,
				mean,
				min,
				max,
				last_state as last
			FROM ${sql.identifier(aggregateTable)}
			WHERE "entityId" = ${entityId}
				AND ${sql.identifier(timeColumn)} >= ${start}
				AND ${sql.identifier(timeColumn)} <= ${end}
			ORDER BY ${sql.identifier(timeColumn)} ASC
		`);

		return getRowsFromResult(result).map((row: Record<string, unknown>) => ({
			last: row.last as string | null,
			max: row.max as number | null,
			mean: row.mean as number | null,
			min: row.min as number | null,
			timestamp: Number(row.timestamp),
		}));
	} catch (error) {
		// Fallback to raw history query if continuous aggregate doesn't exist
		console.warn(
			`Continuous aggregate ${aggregateTable} not found, falling back to raw query:`,
			error,
		);

		const result = await db
			.select({
				state: entityStateHistory.state,
				ts: entityStateHistory.ts,
			})
			.from(entityStateHistory)
			.where(
				and(
					eq(entityStateHistory.entityId, entityId),
					gte(entityStateHistory.ts, start),
					lte(entityStateHistory.ts, end),
				),
			)
			.orderBy(asc(entityStateHistory.ts));

		// Simple aggregation by time bucket
		const timeBucketMs = getTimeBucketMs(bucket);
		const aggregated = new Map<
			number,
			{ values: number[]; states: string[] }
		>();

		result.forEach((row) => {
			const bucketTime =
				Math.floor(row.ts.getTime() / timeBucketMs) * timeBucketMs;
			const value =
				typeof row.state === 'number' ? row.state : Number(row.state);
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
}

/**
 * Get raw state history for a single entity (fallback when continuous aggregates aren't available)
 */
export async function getEntityRawHistory(
	entityId: string,
	timeRange: TimeRange = '24h',
	limit = 1000,
): Promise<ChartDataPoint[]> {
	const { start, end } = getTimeRangeDates(timeRange);

	const result = await db
		.select({
			state: entityStateHistory.state,
			ts: entityStateHistory.ts,
		})
		.from(entityStateHistory)
		.where(
			and(
				eq(entityStateHistory.entityId, entityId),
				gte(entityStateHistory.ts, start),
				lte(entityStateHistory.ts, end),
			),
		)
		.orderBy(asc(entityStateHistory.ts))
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
	timeBucket?: TimeBucket,
): Promise<MultiEntityDataPoint[]> {
	const { start, end } = getTimeRangeDates(timeRange);
	const bucket = timeBucket || getOptimalTimeBucket(timeRange);
	const aggregateTable = getContinuousAggregateTable(bucket);

	// Determine the time column name based on bucket
	const timeColumn =
		bucket === '1day'
			? 'day_start'
			: bucket === '1hour'
				? 'hour_start'
				: 'minute_start';

	try {
		// Use TimescaleDB continuous aggregate for efficient multi-entity querying
		const result = await db.execute(sql`
			SELECT
				EXTRACT(EPOCH FROM ${sql.identifier(timeColumn)}) * 1000 as timestamp,
				"entityId",
				mean
			FROM ${sql.identifier(aggregateTable)}
			WHERE "entityId" = ANY(${entityIds})
				AND ${sql.identifier(timeColumn)} >= ${start}
				AND ${sql.identifier(timeColumn)} <= ${end}
			ORDER BY ${sql.identifier(timeColumn)} ASC, "entityId"
		`);

		// Combine data points by timestamp
		const timestampMap = new Map<number, MultiEntityDataPoint>();

		getRowsFromResult(result).forEach((row: Record<string, unknown>) => {
			const timestamp = Number(row.timestamp);
			const entityId = row.entityId as string;
			const value = row.mean as number | null;

			if (!timestampMap.has(timestamp)) {
				timestampMap.set(timestamp, { timestamp });
			}

			const dataPoint = timestampMap.get(timestamp);
			if (!dataPoint) return;
			dataPoint[entityId] = value ?? 0;
		});

		return Array.from(timestampMap.values()).sort(
			(a, b) => a.timestamp - b.timestamp,
		);
	} catch (error) {
		// Fallback to raw history query if continuous aggregate doesn't exist
		console.warn(
			`Continuous aggregate ${aggregateTable} not found, falling back to raw query:`,
			error,
		);

		// Get data for each entity separately and combine
		const entityDataPromises = entityIds.map(async (entityId) => {
			const result = await db
				.select({
					state: entityStateHistory.state,
					ts: entityStateHistory.ts,
				})
				.from(entityStateHistory)
				.where(
					and(
						eq(entityStateHistory.entityId, entityId),
						gte(entityStateHistory.ts, start),
						lte(entityStateHistory.ts, end),
					),
				)
				.orderBy(asc(entityStateHistory.ts));

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
}

// ===================================
// Room-Level Aggregation
// ===================================

/**
 * Get aggregated sensor data for all entities in a room
 */
export async function getRoomAggregatedData(
	roomId: string,
	entityKind: string, // e.g., 'sensor', 'light', etc.
	timeRange: TimeRange = '24h',
	timeBucket?: TimeBucket,
): Promise<AggregatedDataPoint[]> {
	const { start, end } = getTimeRangeDates(timeRange);
	const bucket = timeBucket || getOptimalTimeBucket(timeRange);
	const aggregateTable = getContinuousAggregateTable(bucket);

	// Determine the time column name based on bucket
	const timeColumn =
		bucket === '1day'
			? 'day_start'
			: bucket === '1hour'
				? 'hour_start'
				: 'minute_start';

	try {
		// Use TimescaleDB continuous aggregate for efficient room-level querying
		const result = await db.execute(sql`
			SELECT
				EXTRACT(EPOCH FROM ${sql.identifier(timeColumn)}) * 1000 as timestamp,
				AVG(mean) as mean,
				MIN(min) as min,
				MAX(max) as max,
				(ARRAY_AGG(last_state ORDER BY ${sql.identifier(timeColumn)} DESC))[1] as last
			FROM ${sql.identifier(aggregateTable)} es
			JOIN entity e ON es."entityId" = e.id
			JOIN device d ON e."deviceId" = d.id
			WHERE d."roomId" = ${roomId}
				AND e.kind = ${entityKind}
				AND ${sql.identifier(timeColumn)} >= ${start}
				AND ${sql.identifier(timeColumn)} <= ${end}
			GROUP BY ${sql.identifier(timeColumn)}
			ORDER BY ${sql.identifier(timeColumn)} ASC
		`);

		return getRowsFromResult(result).map((row: Record<string, unknown>) => ({
			last: row.last as string | null,
			max: row.max as number | null,
			mean: row.mean as number | null,
			min: row.min as number | null,
			timestamp: Number(row.timestamp),
		}));
	} catch (error) {
		// Fallback to raw history query if continuous aggregate doesn't exist
		console.warn(
			`Continuous aggregate ${aggregateTable} not found, falling back to raw query:`,
			error,
		);

		// Get all entities in the room of the specified kind
		const entities = await db
			.select({
				entityId: entity.id,
			})
			.from(entity)
			.innerJoin(device, eq(entity.deviceId, device.id))
			.where(and(eq(device.roomId, roomId), eq(entity.kind, entityKind)));

		if (entities.length === 0) {
			return [];
		}

		const entityIds = entities.map((e) => e.entityId);

		// Get state history for all entities
		const result = await db
			.select({
				state: entityStateHistory.state,
				ts: entityStateHistory.ts,
			})
			.from(entityStateHistory)
			.where(
				and(
					sql`${entityStateHistory.entityId} = ANY(${entityIds})`,
					gte(entityStateHistory.ts, start),
					lte(entityStateHistory.ts, end),
				),
			)
			.orderBy(asc(entityStateHistory.ts));

		// Simple aggregation by time bucket
		const timeBucketMs = getTimeBucketMs(bucket);
		const aggregated = new Map<
			number,
			{ values: number[]; states: string[] }
		>();

		result.forEach((row) => {
			const bucketTime =
				Math.floor(row.ts.getTime() / timeBucketMs) * timeBucketMs;
			const value =
				typeof row.state === 'number' ? row.state : Number(row.state);
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
}

// ===================================
// Home-Level Aggregation
// ===================================

/**
 * Get aggregated sensor data for all entities of a specific kind in a home
 */
export async function getHomeAggregatedData(
	homeId: string,
	entityKind: string,
	timeRange: TimeRange = '24h',
	timeBucket?: TimeBucket,
): Promise<AggregatedDataPoint[]> {
	const { start, end } = getTimeRangeDates(timeRange);
	const bucket = timeBucket || getOptimalTimeBucket(timeRange);
	const aggregateTable = getContinuousAggregateTable(bucket);

	// Determine the time column name based on bucket
	const timeColumn =
		bucket === '1day'
			? 'day_start'
			: bucket === '1hour'
				? 'hour_start'
				: 'minute_start';

	try {
		// Use TimescaleDB continuous aggregate for efficient home-level querying
		const result = await db.execute(sql`
			SELECT
				EXTRACT(EPOCH FROM ${sql.identifier(timeColumn)}) * 1000 as timestamp,
				AVG(mean) as mean,
				MIN(min) as min,
				MAX(max) as max,
				(ARRAY_AGG(last_state ORDER BY ${sql.identifier(timeColumn)} DESC))[1] as last
			FROM ${sql.identifier(aggregateTable)} es
			JOIN entity e ON es."entityId" = e.id
			JOIN device d ON e."deviceId" = d.id
			WHERE d."homeId" = ${homeId}
				AND e.kind = ${entityKind}
				AND ${sql.identifier(timeColumn)} >= ${start}
				AND ${sql.identifier(timeColumn)} <= ${end}
			GROUP BY ${sql.identifier(timeColumn)}
			ORDER BY ${sql.identifier(timeColumn)} ASC
		`);

		return getRowsFromResult(result).map((row: Record<string, unknown>) => ({
			last: row.last as string | null,
			max: row.max as number | null,
			mean: row.mean as number | null,
			min: row.min as number | null,
			timestamp: Number(row.timestamp),
		}));
	} catch (error) {
		// Fallback to raw history query if continuous aggregate doesn't exist
		console.warn(
			`Continuous aggregate ${aggregateTable} not found, falling back to raw query:`,
			error,
		);

		// Get all entities in the home of the specified kind
		const entities = await db
			.select({
				entityId: entity.id,
			})
			.from(entity)
			.innerJoin(device, eq(entity.deviceId, device.id))
			.where(and(eq(device.homeId, homeId), eq(entity.kind, entityKind)));

		if (entities.length === 0) {
			return [];
		}

		const entityIds = entities.map((e) => e.entityId);

		// Get state history for all entities
		const result = await db
			.select({
				state: entityStateHistory.state,
				ts: entityStateHistory.ts,
			})
			.from(entityStateHistory)
			.where(
				and(
					sql`${entityStateHistory.entityId} = ANY(${entityIds})`,
					gte(entityStateHistory.ts, start),
					lte(entityStateHistory.ts, end),
				),
			)
			.orderBy(asc(entityStateHistory.ts));

		// Simple aggregation by time bucket
		const timeBucketMs = getTimeBucketMs(bucket);
		const aggregated = new Map<
			number,
			{ values: number[]; states: string[] }
		>();

		result.forEach((row) => {
			const bucketTime =
				Math.floor(row.ts.getTime() / timeBucketMs) * timeBucketMs;
			const value =
				typeof row.state === 'number' ? row.state : Number(row.state);
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
			currentState: {
				attrs: entityStateHistory.attrs,
				state: entityStateHistory.state,
				ts: entityStateHistory.ts,
			},
			entityId: entity.id,
			key: entity.key,
			kind: entity.kind,
			traits: entity.traits,
		})
		.from(entity)
		.leftJoin(
			entityStateHistory,
			and(
				eq(entityStateHistory.entityId, entity.id),
				eq(
					entityStateHistory.ts,
					sql`(
          SELECT MAX(ts)
          FROM entity_state_history
          WHERE entity_id = ${entity.id}
        )`,
				),
			),
		)
		.where(eq(entity.deviceId, deviceId))
		.orderBy(entity.key);

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
	const entities = await db
		.select({
			entityId: entity.id,
			kind: entity.kind,
		})
		.from(entity)
		.innerJoin(device, eq(entity.deviceId, device.id))
		.where(and(eq(device.homeId, homeId), eq(entity.kind, 'sensor')));

	if (entities.length === 0) {
		return [];
	}

	const entityIds = entities.map((e) => e.entityId);

	// Get latest state for each entity
	const latestStates = await db
		.select({
			entityId: entityStateHistory.entityId,
			state: entityStateHistory.state,
		})
		.from(entityStateHistory)
		.where(sql`${entityStateHistory.entityId} = ANY(${entityIds})`)
		.orderBy(desc(entityStateHistory.ts));

	// Group by entity kind and calculate statistics
	const kindStats = new Map<string, { count: number; values: number[] }>();

	entities.forEach((entity) => {
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
			const entity = entities.find((e) => e.entityId === state.entityId);
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
			entityId: entityStateHistory.entityId,
			ts: entityStateHistory.ts,
		})
		.from(entityStateHistory)
		.innerJoin(entity, eq(entityStateHistory.entityId, entity.id))
		.innerJoin(device, eq(entity.deviceId, device.id))
		.where(
			and(eq(device.homeId, homeId), gte(entityStateHistory.ts, oneDayAgo)),
		)
		.orderBy(desc(entityStateHistory.ts));

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
	getContinuousAggregateTable,

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

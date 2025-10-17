/**
 * Database Layer for Hub Daemon
 * Uses Drizzle ORM with Home Assistant++ schema
 * Replaces SupabaseSync with direct schema operations
 */

import type { Device, Entity, EntityStateHistory } from '@cove/db';
import { db } from '@cove/db/client';
import {
	device,
	entity,
	entityState,
	entityStateHistory,
	event,
	eventPayload,
	eventType,
	home,
} from '@cove/db/schema';
import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import type { InferInsertModel } from 'drizzle-orm';
import { and, desc, eq } from 'drizzle-orm';

const log = debug('cove:hub:db');

// Insert types for database operations
type HomeInsert = InferInsertModel<typeof home>;
type DeviceInsert = InferInsertModel<typeof device>;
type EntityInsert = InferInsertModel<typeof entity>;
type EntityStateHistoryInsert = InferInsertModel<typeof entityStateHistory>;
type EventInsert = InferInsertModel<typeof event>;
type EventTypeInsert = InferInsertModel<typeof eventType>;
type EventPayloadInsert = InferInsertModel<typeof eventPayload>;

export class HubDatabase {
	private heartbeatInterval: Timer | null = null;
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
				.update(device)
				.set({
					updatedAt: new Date(),
				})
				.where(eq(device.id, this.hubDeviceId));

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
			// Check if home already exists
			const existingHome = await db.query.home.findFirst({
				where: eq(home.name, name),
			});

			if (existingHome) {
				log(`Using existing home: ${existingHome.id} (${name})`);
				return existingHome.id;
			}

			// Create new home
			const homeId = createId({ prefix: 'home' });
			const homeData: HomeInsert = {
				address,
				id: homeId,
				name,
				timezone,
			};

			await db.insert(home).values(homeData);

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
		ipAddress?: string;
		manufacturer?: string;
		model?: string;
		metadata?: Record<string, unknown>;
	}): Promise<Device | null> {
		try {
			log(`Registering hub as device: ${params.name}`);

			const deviceId = createId({ prefix: 'device' });
			const deviceData: DeviceInsert = {
				homeId: params.homeId,
				id: deviceId,
				ipAddress: params.ipAddress,
				manufacturer: params.manufacturer || 'Cove',
				metadata: params.metadata,
				model: params.model || 'Cove Hub',
				name: params.name,
			};

			await db.insert(device).values(deviceData);

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
		manufacturer?: string;
		model?: string;
		ipAddress?: string;
		metadata?: Record<string, unknown>;
		roomId?: string;
		viaDeviceId?: string;
		matterNodeId?: number;
	}): Promise<Device | null> {
		try {
			const deviceId = createId({ prefix: 'device' });
			const deviceData: DeviceInsert = {
				homeId: params.homeId,
				id: deviceId,
				ipAddress: params.ipAddress,
				manufacturer: params.manufacturer,
				matterNodeId: params.matterNodeId,
				metadata: params.metadata,
				model: params.model,
				name: params.name,
				roomId: params.roomId,
				viaDeviceId: params.viaDeviceId,
			};

			await db.insert(device).values(deviceData);

			log(`Inserted device: ${deviceId} (${params.name})`);
			return deviceData as Device;
		} catch (error) {
			log('Failed to insert device:', error);
			return null;
		}
	}

	/**
	 * Create entity record
	 */
	async createEntity(params: {
		deviceId: string;
		kind: string;
		key: string;
		traits: Record<string, unknown>;
	}): Promise<string | null> {
		try {
			const entityId = createId({ prefix: 'entity' });
			const entityData: EntityInsert = {
				deviceId: params.deviceId,
				id: entityId,
				key: params.key,
				kind: params.kind,
				traits: params.traits,
			};

			await db.insert(entity).values(entityData);

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
				.insert(entityState)
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
					target: entityState.entityId,
				});

			return true;
		} catch (error) {
			log('Failed to upsert entity state:', error);
			return false;
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

			await db.insert(entityStateHistory).values(historyData);
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
			const entities = await db.query.entity.findMany({
				where: eq(entity.deviceId, deviceId),
			});

			return entities;
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
				.from(entity)
				.innerJoin(device, eq(device.id, entity.deviceId))
				.where(eq(entity.id, entityId))
				.limit(1);

			if (result.length === 0) {
				return null;
			}
			if (!result[0]?.device || !result[0]?.entity) {
				throw new Error('Entity or device not found');
			}
			return {
				device: result[0].device,
				entity: result[0].entity,
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
			const conditions = [eq(entityStateHistory.entityId, params.entityId)];

			if (params.since) {
				// Note: This would need a proper date comparison - simplified for now
				conditions.push(eq(entityStateHistory.entityId, params.entityId));
			}

			const query = db
				.select()
				.from(entityStateHistory)
				.where(and(...conditions))
				.orderBy(desc(entityStateHistory.ts))
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
		contextId?: string;
		originIdx?: number;
	}): Promise<boolean> {
		try {
			// First, ensure event type exists
			const eventTypeId = await this.getOrCreateEventType(params.eventType);
			if (!eventTypeId) {
				log('Failed to get/create event type');
				return false;
			}

			// Create event payload
			const payloadId = await this.createEventPayload({
				body: {
					message: params.message,
					metadata: params.metadata,
				},
			});

			if (!payloadId) {
				log('Failed to create event payload');
				return false;
			}

			// Insert event
			const eventData: EventInsert = {
				contextId: params.contextId,
				eventTypeId,
				homeId: params.homeId,
				originIdx: params.originIdx,
				payloadId,
				ts: new Date(),
			};

			await db.insert(event).values(eventData);
			return true;
		} catch (error) {
			log('Failed to insert device event:', error);
			return false;
		}
	}

	/**
	 * Get or create event type
	 */
	private async getOrCreateEventType(
		eventTypeName: string,
	): Promise<number | null> {
		try {
			// Try to find existing event type
			const existing = await db.query.eventType.findFirst({
				where: eq(eventType.eventType, eventTypeName),
			});

			if (existing) {
				return existing.id;
			}

			// Create new event type
			const eventTypeData: EventTypeInsert = {
				eventType: eventTypeName,
			};

			const result = await db
				.insert(eventType)
				.values(eventTypeData)
				.returning();
			return result[0]?.id || null;
		} catch (error) {
			log('Failed to get/create event type:', error);
			return null;
		}
	}

	/**
	 * Create event payload
	 */
	private async createEventPayload(params: {
		body: Record<string, unknown>;
	}): Promise<number | null> {
		try {
			const payloadData: EventPayloadInsert = {
				body: params.body,
				// Note: hash calculation would be implemented here
			};

			const result = await db
				.insert(eventPayload)
				.values(payloadData)
				.returning();
			return result[0]?.id || null;
		} catch (error) {
			log('Failed to create event payload:', error);
			return null;
		}
	}

	/**
	 * Mark hub device as offline before shutdown
	 */
	async markDeviceOffline(deviceId: string): Promise<void> {
		this.stopHeartbeat();

		try {
			await db
				.update(device)
				.set({
					updatedAt: new Date(),
				})
				.where(eq(device.id, deviceId));

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

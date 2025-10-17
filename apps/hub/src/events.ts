/**
 * Device Event Collector
 * Captures and stores device events for activity feed and debugging
 * Works for ALL devices including hubs
 */

import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import { type DeviceEvent, getLogLevel, HubEventType } from '@cove/types';
import type { HubDatabase } from './db';

const log = debug('cove:hub:events');

interface EventCollectorOptions {
  deviceId: string; // Default device ID (typically the hub)
  db?: HubDatabase | null;
  bufferSize?: number;
  syncInterval?: number; // seconds
}

export class DeviceEventCollector {
  private defaultDeviceId: string; // Default device ID for hub events
  private db: HubDatabase | null;
  private eventBuffer: DeviceEvent[] = [];
  private bufferSize: number;
  private syncInterval: number;
  private syncTimer: Timer | null = null;

  constructor(options: EventCollectorOptions) {
    this.defaultDeviceId = options.deviceId;
    this.db = options.db || null;
    this.bufferSize = options.bufferSize || 1000;
    this.syncInterval = options.syncInterval || 30; // 30 seconds default
  }

  /**
   * Start the event collector and sync timer
   */
  start(): void {
    log('Starting event collector');

    if (this.db) {
      this.syncTimer = setInterval(() => {
        this.syncEvents();
      }, this.syncInterval * 1000);
    }

    this.emit({
      eventType: HubEventType.HubStarted,
      message: 'Hub daemon started',
    });
  }

  /**
   * Stop the event collector and sync remaining events
   */
  async stop(): Promise<void> {
    log('Stopping event collector');

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    this.emit({
      eventType: HubEventType.HubStopped,
      message: 'Hub daemon stopped',
    });

    // Final sync before stopping
    if (this.db && this.eventBuffer.length > 0) {
      await this.syncEvents();
    }
  }

  /**
   * Emit a new event
   * Can emit events for any device, not just the hub
   */
  emit(event: {
    eventType: HubEventType;
    message: string;
    deviceId?: string; // Optional - defaults to hub device ID
    metadata?: Record<string, unknown>;
    stateId?: string; // Optional link to state history
  }): void {
    const deviceEvent: DeviceEvent = {
      deviceId: event.deviceId || this.defaultDeviceId, // Use provided deviceId or default to hub
      eventType: event.eventType,
      id: createId({ prefix: 'event' }),
      message: event.message,
      metadata: event.metadata,
      stateId: event.stateId, // Link to state history if provided
      timestamp: new Date(),
    };

    // Add to circular buffer
    this.eventBuffer.push(deviceEvent);

    // Maintain buffer size limit (circular buffer behavior)
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer.shift();
    }

    // Log event using inferred log level
    const logLevel = getLogLevel(event.eventType);

    if (logLevel === 'error') {
      console.error(`[${event.eventType}] ${event.message}`, event.metadata);
    } else if (logLevel === 'warn') {
      console.warn(`[${event.eventType}] ${event.message}`, event.metadata);
    } else if (logLevel === 'info') {
      console.info(`[${event.eventType}] ${event.message}`, event.metadata);
    } else {
      log(`[${event.eventType}] ${event.message}`, event.metadata);
    }
  }

  /**
   * Sync events to database using HubDatabase
   */
  private async syncEvents(): Promise<void> {
    if (!this.db || this.eventBuffer.length === 0) {
      return;
    }

    const eventsToSync = [...this.eventBuffer];

    try {
      log(`Syncing ${eventsToSync.length} events to database`);

      // Get home ID from the first event's device (assuming all events are for the same home)
      const firstEvent = eventsToSync[0];
      if (!firstEvent?.deviceId) {
        log('No device ID found in events, skipping sync');
        return;
      }

      // Insert each event using HubDatabase
      let successCount = 0;
      for (const event of eventsToSync) {
        const success = await this.db.insertDeviceEvent({
          contextId: event.deviceId,
          eventType: event.eventType,
          homeId: firstEvent?.deviceId, // TODO: Get actual home ID from device
          message: event.message,
          metadata: event.metadata,
        });

        if (success) {
          successCount++;
        }
      }

      if (successCount === eventsToSync.length) {
        // Clear synced events from buffer
        this.eventBuffer = [];
        log(`Successfully synced ${successCount} events`);
      } else {
        log(
          `Only synced ${successCount}/${eventsToSync.length} events, will retry next interval`,
        );
      }
    } catch (error) {
      log('Error syncing events:', error);
      // Events remain in buffer for retry
    }
  }

  /**
   * Get recent events from buffer
   */
  getRecentEvents(options?: {
    limit?: number;
    eventType?: HubEventType;
    since?: Date;
  }): DeviceEvent[] {
    let events = [...this.eventBuffer];

    // Filter by event type
    if (options?.eventType) {
      events = events.filter((e) => e.eventType === options.eventType);
    }

    // Filter by timestamp
    if (options?.since) {
      events = events.filter((e) => e.timestamp >= (options.since as Date));
    }

    // Sort by timestamp descending (most recent first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limit results
    if (options?.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  /**
   * Get event count by event type
   */
  getEventCountsByType(): Record<HubEventType, number> {
    const counts: Record<HubEventType, number> = {} as Record<
      HubEventType,
      number
    >;

    // Initialize all event types to 0
    for (const eventType of Object.values(HubEventType)) {
      counts[eventType] = 0;
    }

    for (const event of this.eventBuffer) {
      counts[event.eventType]++;
    }

    return counts;
  }

  /**
   * Clear all events from buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
    log('Event buffer cleared');
  }
}

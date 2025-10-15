/**
 * Device Event Collector
 * Captures and stores device events for activity feed and debugging
 * Works for ALL devices including hubs
 */

import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import { type DeviceEvent, EventSeverity, EventType } from '@cove/types';
import type { SupabaseSync } from './supabase';

const log = debug('cove:hub:events');

interface EventCollectorOptions {
  deviceId: string; // Default device ID (typically the hub)
  supabaseSync?: SupabaseSync | null;
  bufferSize?: number;
  syncInterval?: number; // seconds
}

export class DeviceEventCollector {
  private defaultDeviceId: string; // Default device ID for hub events
  private supabaseSync: SupabaseSync | null;
  private eventBuffer: DeviceEvent[] = [];
  private bufferSize: number;
  private syncInterval: number;
  private syncTimer: Timer | null = null;

  constructor(options: EventCollectorOptions) {
    this.defaultDeviceId = options.deviceId;
    this.supabaseSync = options.supabaseSync || null;
    this.bufferSize = options.bufferSize || 1000;
    this.syncInterval = options.syncInterval || 30; // 30 seconds default
  }

  /**
   * Start the event collector and sync timer
   */
  start(): void {
    log('Starting event collector');

    if (this.supabaseSync) {
      this.syncTimer = setInterval(() => {
        this.syncEvents();
      }, this.syncInterval * 1000);
    }

    this.emit({
      eventType: EventType.HubStarted,
      message: 'Hub daemon started',
      severity: EventSeverity.Info,
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
      eventType: EventType.HubStopped,
      message: 'Hub daemon stopped',
      severity: EventSeverity.Info,
    });

    // Final sync before stopping
    if (this.supabaseSync && this.eventBuffer.length > 0) {
      await this.syncEvents();
    }
  }

  /**
   * Emit a new event
   * Can emit events for any device, not just the hub
   */
  emit(event: {
    eventType: EventType;
    message: string;
    severity: EventSeverity;
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
      severity: event.severity,
      stateId: event.stateId, // Link to state history if provided
      timestamp: new Date(),
    };

    // Add to circular buffer
    this.eventBuffer.push(deviceEvent);

    // Maintain buffer size limit (circular buffer behavior)
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer.shift();
    }

    // Log event
    const logLevel =
      event.severity === EventSeverity.Error ||
      event.severity === EventSeverity.Critical
        ? 'error'
        : 'debug';

    if (logLevel === 'error') {
      console.error(`[${event.eventType}] ${event.message}`, event.metadata);
    } else {
      log(`[${event.eventType}] ${event.message}`, event.metadata);
    }
  }

  /**
   * Sync events to Supabase
   */
  private async syncEvents(): Promise<void> {
    if (!this.supabaseSync || this.eventBuffer.length === 0) {
      return;
    }

    const eventsToSync = [...this.eventBuffer];

    try {
      log(`Syncing ${eventsToSync.length} events to Supabase`);
      const success = await this.supabaseSync.insertDeviceEvents(eventsToSync);

      if (success) {
        // Clear synced events from buffer
        this.eventBuffer = [];
        log(`Successfully synced ${eventsToSync.length} events`);
      } else {
        log('Failed to sync events, will retry next interval');
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
    severity?: EventSeverity;
    eventType?: EventType;
    since?: Date;
  }): DeviceEvent[] {
    let events = [...this.eventBuffer];

    // Filter by severity
    if (options?.severity) {
      events = events.filter((e) => e.severity === options.severity);
    }

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
   * Get event count by severity
   */
  getEventCountsBySeverity(): Record<EventSeverity, number> {
    const counts: Record<EventSeverity, number> = {
      [EventSeverity.Info]: 0,
      [EventSeverity.Warning]: 0,
      [EventSeverity.Error]: 0,
      [EventSeverity.Critical]: 0,
    };

    for (const event of this.eventBuffer) {
      counts[event.severity]++;
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

/**
 * EventBus - In-process pub/sub messaging for Hub V2
 * Class-based implementation using Map-based callbacks
 */

export type EventCallback<T = unknown> = (data: T) => void;

export type EventTopics =
  | `entity/${string}/state`
  | `device/${string}/lifecycle`
  | `telemetry`
  | `command/${string}`
  | `error`;

export interface EventMessage<T = unknown> {
  topic: EventTopics;
  data: T;
  timestamp: Date;
}

export interface StateChangedEvent {
  entityId: string;
  state: Record<string, unknown>;
  previousState?: Record<string, unknown>;
}

export interface DeviceLifecycleEvent {
  deviceId: string;
  event:
    | 'discovered'
    | 'paired'
    | 'unpaired'
    | 'connected'
    | 'disconnected'
    | 'error';
  details?: Record<string, unknown>;
}

export interface TelemetryEvent {
  entityId: string;
  field: string;
  value: number | string | boolean;
  unit?: string;
}

export interface CommandEvent {
  entityId: string;
  command: Record<string, unknown>;
  success: boolean;
  latency?: number;
}

export interface ErrorEvent {
  source: string;
  error: string;
  context?: Record<string, unknown>;
}

/**
 * EventBus class - In-process pub/sub messaging
 */
export class EventBus {
  private subscribers = new Map<EventTopics, Set<EventCallback>>();
  private messageQueue: EventMessage[] = [];
  private processing = false;

  /**
   * Subscribe to a topic
   */
  subscribe<T = unknown>(
    topic: EventTopics,
    callback: EventCallback<T>,
  ): () => void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }

    const topicSubscribers = this.subscribers.get(topic);
    if (!topicSubscribers) {
      throw new Error(`Topic subscribers not found for: ${topic}`);
    }
    topicSubscribers.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      topicSubscribers.delete(callback as EventCallback);
      if (topicSubscribers.size === 0) {
        this.subscribers.delete(topic);
      }
    };
  }

  /**
   * Publish an event to a topic
   */
  publish<T = unknown>(topic: EventTopics, data: T): void {
    const message: EventMessage<T> = {
      data,
      timestamp: new Date(),
      topic,
    };

    this.messageQueue.push(message);

    // Process queue asynchronously to avoid blocking
    if (!this.processing) {
      this.processing = true;
      setImmediate(() => {
        this.processMessageQueue();
        this.processing = false;
      });
    }
  }

  /**
   * Process the message queue
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (!message) continue;

      const topicSubscribers = this.subscribers.get(message.topic);
      if (!topicSubscribers) continue;

      // Call all subscribers for this topic
      for (const callback of topicSubscribers) {
        try {
          callback(message.data);
        } catch (error) {
          console.error(
            `Error in event callback for topic ${message.topic}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Publish state changed event
   */
  publishStateChanged(event: StateChangedEvent): void {
    this.publish(`entity/${event.entityId}/state`, event);
  }

  /**
   * Publish device lifecycle event
   */
  publishDeviceLifecycle(event: DeviceLifecycleEvent): void {
    this.publish(`device/${event.deviceId}/lifecycle`, event);
  }

  /**
   * Publish telemetry event
   */
  publishTelemetry(event: TelemetryEvent): void {
    this.publish('telemetry', event);
  }

  /**
   * Publish command event
   */
  publishCommand(entityId: string, event: CommandEvent): void {
    this.publish(`command/${entityId}`, event);
  }

  /**
   * Publish error event
   */
  publishError(event: ErrorEvent): void {
    this.publish('error', event);
  }

  /**
   * Get subscriber count for a topic
   */
  getSubscriberCount(topic: EventTopics): number {
    return this.subscribers.get(topic)?.size ?? 0;
  }

  /**
   * Get all active topics
   */
  getActiveTopics(): EventTopics[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Clear all subscribers (useful for testing)
   */
  clear(): void {
    this.subscribers.clear();
    this.messageQueue.length = 0;
  }
}

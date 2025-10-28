/**
 * CommandRouter - Normalized command handling for Hub V2
 * Routes commands to appropriate drivers with retry, rate limiting, and coalescing
 */

import { debug } from '@cove/logger';
import type { Device, Entity } from '../db/types';
import type { Driver } from './driver-kit';
import type { EventBus } from './event-bus';
import type { Registry } from './registry';

const log = debug('cove:hub-v2:command-router');

export interface CommandRouterOptions {
  registry: Registry;
  eventBus: EventBus;
  drivers: Map<string, Driver>;
}

export interface CommandRequest {
  entityId: string;
  capability: string;
  value: unknown;
  userId?: string;
}

export interface CommandResult {
  success: boolean;
  latency: number;
  error?: string;
}

interface InFlightCommand {
  promise: Promise<CommandResult>;
  timestamp: Date;
}

interface RateLimitEntry {
  lastCommand: Date;
  count: number;
}

/**
 * CommandRouter class
 */
export class CommandRouter {
  private registry: Registry;
  private eventBus: EventBus;
  private drivers: Map<string, Driver>;
  private inFlightCommands = new Map<string, InFlightCommand>();
  private rateLimits = new Map<string, RateLimitEntry>();
  private coalescingQueue = new Map<string, CommandRequest>();
  private coalescingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly RATE_LIMIT_WINDOW = 1000; // 1 second
  private readonly RATE_LIMIT_MAX = 10; // max 10 commands per second per entity
  private readonly COALESCE_WINDOW = 100; // 100ms

  constructor(options: CommandRouterOptions) {
    this.registry = options.registry;
    this.eventBus = options.eventBus;
    this.drivers = options.drivers;
  }

  /**
   * Start command coalescing
   */
  startCoalescing() {
    if (this.coalescingTimer) return;

    this.coalescingTimer = setInterval(() => {
      if (this.coalescingQueue.size === 0) return;

      const commands = Array.from(this.coalescingQueue.values());
      this.coalescingQueue.clear();

      // Process coalesced commands
      for (const command of commands) {
        this.processCommandInternal(command).catch((error) => {
          log('Error processing coalesced command:', error);
        });
      }
    }, this.COALESCE_WINDOW);

    log('Started command coalescing');
  }

  /**
   * Stop command coalescing
   */
  stopCoalescing() {
    if (this.coalescingTimer) {
      clearInterval(this.coalescingTimer);
      this.coalescingTimer = null;
    }

    // Process remaining coalesced commands
    if (this.coalescingQueue.size > 0) {
      const commands = Array.from(this.coalescingQueue.values());
      this.coalescingQueue.clear();

      for (const command of commands) {
        this.processCommandInternal(command).catch((error) => {
          log('Error processing remaining coalesced command:', error);
        });
      }
    }

    log('Stopped command coalescing');
  }

  /**
   * Check rate limit for entity
   */
  private checkRateLimit(entityId: string): boolean {
    const now = new Date();
    const entry = this.rateLimits.get(entityId);

    if (!entry) {
      this.rateLimits.set(entityId, { count: 1, lastCommand: now });
      return true;
    }

    // Reset counter if window has passed
    if (now.getTime() - entry.lastCommand.getTime() > this.RATE_LIMIT_WINDOW) {
      this.rateLimits.set(entityId, { count: 1, lastCommand: now });
      return true;
    }

    // Check if within rate limit
    if (entry.count < this.RATE_LIMIT_MAX) {
      entry.count++;
      entry.lastCommand = now;
      return true;
    }

    return false;
  }

  /**
   * Process command with coalescing for rapid updates
   */
  async processCommand(command: CommandRequest): Promise<CommandResult> {
    const startTime = Date.now();

    // Check if this is a rapid update that should be coalesced
    const shouldCoalesce = this.shouldCoalesceCommand(command);

    if (shouldCoalesce) {
      // Add to coalescing queue
      this.coalescingQueue.set(command.entityId, command);

      // Return a promise that will resolve when the coalesced command is processed
      return new Promise((resolve) => {
        const checkCoalescing = () => {
          if (!this.coalescingQueue.has(command.entityId)) {
            // Command was processed, resolve with success
            resolve({
              latency: Date.now() - startTime,
              success: true,
            });
          } else {
            setTimeout(checkCoalescing, 10);
          }
        };
        checkCoalescing();
      });
    }

    return this.processCommandInternal(command);
  }

  /**
   * Check if command should be coalesced (for rapid updates like dimmer scrubs)
   */
  private shouldCoalesceCommand(command: CommandRequest): boolean {
    // Coalesce brightness and color changes for lights
    const coalesceableCapabilities = [
      'brightness',
      'color_temp',
      'hue',
      'saturation',
    ];
    return coalesceableCapabilities.includes(command.capability);
  }

  /**
   * Internal command processing
   */
  private async processCommandInternal(
    command: CommandRequest,
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const commandKey = `${command.entityId}:${command.capability}`;

    try {
      // Check for in-flight command (idempotency)
      const inFlight = this.inFlightCommands.get(commandKey);
      if (inFlight) {
        log(`Command already in flight: ${commandKey}`);
        return await inFlight.promise;
      }

      // Check rate limit
      if (!this.checkRateLimit(command.entityId)) {
        const error = `Rate limit exceeded for entity: ${command.entityId}`;
        log(error);
        return {
          error,
          latency: Date.now() - startTime,
          success: false,
        };
      }

      // Get entity and device info
      const entity = await this.registry.getEntity(command.entityId);
      if (!entity) {
        const error = `Entity not found: ${command.entityId}`;
        log(error);
        return {
          error,
          latency: Date.now() - startTime,
          success: false,
        };
      }

      const device = await this.registry.getDevice(entity.deviceId);
      if (!device) {
        const error = `Device not found for entity: ${command.entityId}`;
        log(error);
        return {
          error,
          latency: Date.now() - startTime,
          success: false,
        };
      }

      // Get driver for device protocol
      const driver = this.drivers.get(device.protocol);
      if (!driver) {
        const error = `No driver found for protocol: ${device.protocol}`;
        log(error);
        return {
          error,
          latency: Date.now() - startTime,
          success: false,
        };
      }

      // Create command promise
      const commandPromise = this.executeDriverCommand(
        driver,
        command,
        entity,
        device,
      );

      // Track in-flight command
      this.inFlightCommands.set(commandKey, {
        promise: commandPromise,
        timestamp: new Date(),
      });

      // Execute command
      const result = await commandPromise;

      // Clean up in-flight command
      this.inFlightCommands.delete(commandKey);

      // Publish command event
      this.eventBus.publishCommand(command.entityId, {
        command: { [command.capability]: command.value },
        entityId: command.entityId,
        latency: result.latency,
        success: result.success,
      });

      log(
        `Command processed: ${commandKey} (${result.success ? 'success' : 'failed'})`,
      );
      return result;
    } catch (error) {
      // Clean up in-flight command on error
      this.inFlightCommands.delete(commandKey);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      log(`Command failed: ${commandKey} - ${errorMessage}`);

      const result = {
        error: errorMessage,
        latency: Date.now() - startTime,
        success: false,
      };

      // Publish command event
      this.eventBus.publishCommand(command.entityId, {
        command: { [command.capability]: command.value },
        entityId: command.entityId,
        latency: result.latency,
        success: false,
      });

      return result;
    }
  }

  /**
   * Execute command on driver with retry logic
   */
  private async executeDriverCommand(
    driver: Driver,
    command: CommandRequest,
    entity: Entity,
    device: Device,
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Map normalized command to driver-specific format
        const driverCommand = this.mapCommandToDriver(command, entity, device);

        // Execute command on driver
        const result = await driver.invoke(command.entityId, {
          capability: command.capability,
          entityId: command.entityId,
          metadata: driverCommand,
          value: command.value,
        });

        if (result.ok) {
          return {
            latency: Date.now() - startTime,
            success: true,
          };
        }
        throw new Error(`Driver returned error: ${JSON.stringify(result)}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < maxRetries) {
          const delay = Math.min(100 * 2 ** (attempt - 1), 1000); // Exponential backoff, max 1s
          log(
            `Command attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return {
      error: lastError?.message || 'Max retries exceeded',
      latency: Date.now() - startTime,
      success: false,
    };
  }

  /**
   * Map normalized command to driver-specific format
   */
  private mapCommandToDriver(
    command: CommandRequest,
    _entity: Entity,
    _device: Device,
  ): Record<string, unknown> {
    // Basic mapping - drivers can override this logic
    return {
      [command.capability]: command.value,
    };
  }

  /**
   * Get in-flight command count
   */
  getInFlightCount(): number {
    return this.inFlightCommands.size;
  }

  /**
   * Get coalescing queue size
   */
  getCoalescingQueueSize(): number {
    return this.coalescingQueue.size;
  }

  /**
   * Clear all in-flight commands and coalescing queue
   */
  clear() {
    this.inFlightCommands.clear();
    this.coalescingQueue.clear();
    this.rateLimits.clear();
    log('Cleared command router state');
  }
}

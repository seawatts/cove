/**
 * CommandRouter - Normalized command handling for Hub V2
 * Routes commands to appropriate drivers with retry, rate limiting, and coalescing
 */

import { debug, error, info, warn } from '@cove/logger';
import type { Device, Entity } from '../db/types';
import { getDriverState as getESPHomeDriverState } from '../drivers/esphome/state';
import type { Driver } from './driver-kit';
import type { EventBus } from './event-bus';
import type { Registry } from './registry';

const logDebug = debug('cove:hub-v2:command-router');
const logInfo = info('cove:hub-v2:command-router');
const logWarn = warn('cove:hub-v2:command-router');
const logError = error('cove:hub-v2:command-router');

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
        this.processCommandInternal(command).catch((err) => {
          logError('Error processing coalesced command:', err);
        });
      }
    }, this.COALESCE_WINDOW);

    logInfo('Started command coalescing');
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
        this.processCommandInternal(command).catch((err) => {
          logError('Error processing remaining coalesced command:', err);
        });
      }
    }

    logInfo('Stopped command coalescing');
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
        logDebug(`Command already in flight: ${commandKey}`);
        return await inFlight.promise;
      }

      // Check rate limit
      if (!this.checkRateLimit(command.entityId)) {
        const errorMsg = `Rate limit exceeded for entity: ${command.entityId}`;
        logWarn(errorMsg);
        return {
          error: errorMsg,
          latency: Date.now() - startTime,
          success: false,
        };
      }

      // Get entity and device info
      const entity = await this.registry.getEntity(command.entityId);
      if (!entity) {
        const errorMsg = `Entity not found: ${command.entityId}`;
        logError(errorMsg);
        return {
          error: errorMsg,
          latency: Date.now() - startTime,
          success: false,
        };
      }

      const device = await this.registry.getDevice(entity.deviceId);
      if (!device) {
        const errorMsg = `Device not found for entity: ${command.entityId}`;
        logError(errorMsg);
        return {
          error: errorMsg,
          latency: Date.now() - startTime,
          success: false,
        };
      }

      // Get driver for device protocol
      const driver = this.drivers.get(device.protocol);
      if (!driver) {
        const errorMsg = `No driver found for protocol: ${device.protocol}`;
        logError(errorMsg);
        return {
          error: errorMsg,
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

      if (result.success) {
        logInfo(`Command processed: ${commandKey}`);
      } else {
        logError(
          `Command failed: ${commandKey} - ${result.error || 'Unknown error'}`,
        );
      }
      return result;
    } catch (err) {
      // Clean up in-flight command on error
      this.inFlightCommands.delete(commandKey);

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logError(`Command failed: ${commandKey} - ${errorMessage}`);

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

        // Construct driver-specific entity ID if needed (e.g., ESPHome uses driverDeviceId:objectId format)
        let driverEntityId = command.entityId;
        if (device.protocol === 'esphome') {
          const credentials = await this.registry.getCredentials(device.id);
          if (credentials) {
            const driverDeviceId = (credentials as { driverDeviceId?: string })
              ?.driverDeviceId;

            if (!driverDeviceId) {
              logError(
                `Cannot construct ESPHome entity ID: missing driverDeviceId for device ${device.id}`,
              );
            } else {
              // Look up objectId from ESPHome connection using entity key
              // Same approach as used in daemon subscription loop
              let entityObjectId: string | undefined;

              if (entity.key) {
                const driverState = getESPHomeDriverState();
                const connection = driverState.connections.get(driverDeviceId);

                if (connection) {
                  // Find entity in connection by key or objectId
                  // Note: entity.key might be stored as either ESPHome key (small number)
                  // or objectId (large number like 2082512631)
                  for (const [
                    storedEntityId,
                    espEntity,
                  ] of connection.entities.entries()) {
                    // Try matching by ESPHome key first (most reliable)
                    const entityKeyMatch =
                      entity.key &&
                      (String(espEntity.key) === String(entity.key) ||
                        Number(espEntity.key) === Number(entity.key));

                    // Also try matching by objectId since entity.key might be stored as objectId
                    const objectIdMatch =
                      entity.key &&
                      (espEntity.objectId === String(entity.key) ||
                        espEntity.objectId === entity.key);

                    if (entityKeyMatch || objectIdMatch) {
                      entityObjectId =
                        espEntity.objectId ||
                        storedEntityId.split(':').slice(1).join(':');
                      break;
                    }
                  }

                  // If still not found, extract from stored entity ID
                  if (!entityObjectId) {
                    for (const [
                      storedEntityId,
                    ] of connection.entities.entries()) {
                      if (storedEntityId.startsWith(`${driverDeviceId}:`)) {
                        const extractedObjectId = storedEntityId
                          .split(':')
                          .slice(1)
                          .join(':');
                        if (extractedObjectId) {
                          entityObjectId = extractedObjectId;
                          break;
                        }
                      }
                    }
                  }
                }
              }

              if (driverDeviceId && entityObjectId) {
                driverEntityId = `${driverDeviceId}:${entityObjectId}`;
                // Only log successful construction in debug mode
              } else {
                // Fallback: try to use the entity ID directly if it's already in driver format
                if (
                  command.entityId.includes(':') &&
                  command.entityId.split(':')[0] === driverDeviceId
                ) {
                  driverEntityId = command.entityId;
                } else {
                  logError(
                    `Cannot construct ESPHome entity ID: driverDeviceId=${driverDeviceId}, entityObjectId=${entityObjectId}, entityKey=${entity.key}`,
                  );
                }
              }
            }
          }
        }

        // Execute command on driver
        const result = await driver.invoke(driverEntityId, {
          capability: command.capability,
          entityId: driverEntityId,
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
          logWarn(
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
    logDebug('Cleared command router state');
  }
}

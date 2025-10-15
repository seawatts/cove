/**
 * Device Command Processor
 * Subscribes to Supabase Realtime for device commands and executes them
 */

import { eq } from '@cove/db';
import { db } from '@cove/db/client';
import { Commands, Devices } from '@cove/db/schema';
import { createClient } from '@cove/db/supabase/server';
import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import type {
  Device,
  DeviceCapability,
  DeviceStateHistory,
  ProtocolAdapter,
} from '@cove/types';
import {
  DeviceCapability as Capability,
  EventSeverity,
  EventType,
  type ProtocolType,
} from '@cove/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ESPHomeAdapter } from './adapters/esphome';
import type { DeviceEventCollector } from './events';
import type { SupabaseSync } from './supabase';

const log = debug('cove:hub:command-processor');

interface DeviceCommand {
  id: string;
  deviceId: string;
  capability: string;
  value: unknown;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export class CommandProcessor {
  private channel: RealtimeChannel | null = null;
  private running = false;
  private adapters: Map<ProtocolType, ProtocolAdapter>;
  private supabase: ReturnType<typeof createClient>;
  private supabaseSync: SupabaseSync | null;
  private eventCollector: DeviceEventCollector | null;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    adapters: Map<ProtocolType, ProtocolAdapter>,
    options?: {
      supabaseSync?: SupabaseSync | null;
      eventCollector?: DeviceEventCollector | null;
    },
  ) {
    this.adapters = adapters;
    this.supabase = createClient();
    this.supabaseSync = options?.supabaseSync || null;
    this.eventCollector = options?.eventCollector || null;
    log('Command processor initialized');
  }

  async start(): Promise<void> {
    if (this.running) {
      log('Command processor already running');
      return;
    }

    log('Starting command processor');

    try {
      // Try to subscribe to Realtime for device commands
      this.channel = this.supabase
        .channel('device-commands')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            filter: 'status=eq.pending',
            schema: 'public',
            table: 'commands',
          },
          async (payload: { new: DeviceCommand }) => {
            const command = payload.new;
            log('New command received via Realtime:', command);
            await this.processCommand(command);
          },
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            log('✅ Subscribed to device commands channel (Realtime)');
          } else if (status === 'CHANNEL_ERROR') {
            log('⚠️ Error subscribing to Realtime, falling back to polling');
            this.startPolling();
          } else if (status === 'TIMED_OUT') {
            log('⚠️ Realtime subscription timed out, falling back to polling');
            this.startPolling();
          }
        });
    } catch (error) {
      log('⚠️ Failed to setup Realtime subscription:', error);
      log('Falling back to polling mode');
      this.startPolling();
    }

    // Process any pending commands from startup
    await this.processPendingCommands();

    this.running = true;
    log('Command processor started');
  }

  /**
   * Start polling for commands (fallback if Realtime fails)
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }

    log('Starting command polling (every 2 seconds)');
    this.pollingInterval = setInterval(() => {
      this.processPendingCommands();
    }, 2000);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      log('Stopped command polling');
    }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      log('Command processor not running');
      return;
    }

    log('Stopping command processor');

    this.stopPolling();

    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.running = false;
    log('Command processor stopped');
  }

  private async processPendingCommands(): Promise<void> {
    try {
      const pendingCommands = await db.query.Commands.findMany({
        limit: 100,
        orderBy: (commands, { asc }) => [asc(commands.createdAt)],
        where: eq(Commands.status, 'pending'),
      });

      if (pendingCommands.length > 0) {
        log(`Found ${pendingCommands.length} pending commands`);
        for (const command of pendingCommands) {
          await this.processCommand(command as DeviceCommand);
        }
      }
    } catch (error) {
      log('Error processing pending commands:', error);
    }
  }

  private async processCommand(command: DeviceCommand): Promise<void> {
    log(`Processing command ${command.id} for device ${command.deviceId}`);

    try {
      // Mark command as processing
      await this.updateCommandStatus(command.id, 'processing');

      // Get the device using Drizzle
      const device = await db.query.Devices.findFirst({
        where: eq(Devices.id, command.deviceId),
      });

      if (!device) {
        throw new Error(`Device ${command.deviceId} not found`);
      }

      // Get the appropriate protocol adapter
      const protocol = device.protocol as ProtocolType;
      const adapter = this.adapters.get(protocol);

      if (!adapter) {
        throw new Error(`No adapter found for protocol: ${protocol}`);
      }

      // Handle ESPHome-specific commands
      if (protocol === 'esphome') {
        const esphomeAdapter = adapter as ESPHomeAdapter;

        switch (command.capability) {
          case 'button_press': {
            const { entityKey } = command.value as { entityKey: number };
            await esphomeAdapter.pressButton(device as Device, entityKey);
            break;
          }
          case 'number_set': {
            const { entityKey, value } = command.value as {
              entityKey: number;
              value: number;
            };
            await esphomeAdapter.setNumber(device as Device, entityKey, value);
            break;
          }
          case 'light_control': {
            const { entityKey, ...lightCommand } = command.value as {
              entityKey: number;
              [key: string]: unknown;
            };
            await esphomeAdapter.controlLight(
              device as Device,
              entityKey,
              lightCommand,
            );
            break;
          }
          default: {
            // Fall back to generic sendCommand for other ESPHome capabilities
            const capabilityMap: Record<string, DeviceCapability> = {
              brightness: Capability.Brightness,
              color_rgb: Capability.ColorRgb,
              color_temperature: Capability.ColorTemperature,
              on_off: Capability.OnOff,
            };

            const capability = capabilityMap[command.capability];
            if (!capability) {
              throw new Error(
                `Unknown ESPHome capability: ${command.capability}`,
              );
            }

            await adapter.sendCommand(device as Device, {
              capability,
              deviceId: command.deviceId,
              timestamp: new Date(),
              value: command.value,
            });
            break;
          }
        }
      } else {
        // Handle other protocols (Hue, etc.)
        const capabilityMap: Record<string, DeviceCapability> = {
          brightness: Capability.Brightness,
          color_rgb: Capability.ColorRgb,
          color_temperature: Capability.ColorTemperature,
          on_off: Capability.OnOff,
        };

        const capability = capabilityMap[command.capability];
        if (!capability) {
          throw new Error(`Unknown capability: ${command.capability}`);
        }

        // Send command to device via adapter
        await adapter.sendCommand(device as Device, {
          capability,
          deviceId: command.deviceId,
          timestamp: new Date(),
          value: command.value,
        });
      }

      // Capture old state before command
      const oldState = { ...device.state };

      // Poll device state after command to get updated state (if supported)
      if (adapter.pollState) {
        await adapter.pollState(device as Device);
      }

      // Update device state in database
      await db
        .update(Devices)
        .set({
          lastSeen: new Date(),
          state: device.state,
        })
        .where(eq(Devices.id, command.deviceId));

      // Record state change to history if state actually changed
      const stateChanged =
        JSON.stringify(oldState) !== JSON.stringify(device.state);
      if (stateChanged && this.supabaseSync) {
        const stateHistory: DeviceStateHistory = {
          attributes: {
            command: {
              capability: command.capability,
              commandId: command.id,
              value: command.value,
            },
          },
          deviceId: command.deviceId,
          id: createId({ prefix: 'state' }),
          lastChanged: new Date(),
          lastUpdated: new Date(),
          state: device.state,
        };

        await this.supabaseSync.insertStateHistory(stateHistory);
        log(`Recorded state change for device ${command.deviceId}`);

        // Emit state_changed event linked to this state history
        if (this.eventCollector) {
          this.eventCollector.emit({
            deviceId: command.deviceId, // Event for the device that changed, not the hub
            eventType: EventType.StateChanged,
            message: `Device state changed via ${command.capability} command`,
            metadata: {
              capability: command.capability,
              commandId: command.id,
              newState: device.state,
              oldState,
            },
            severity: EventSeverity.Info,
            stateId: stateHistory.id, // Link event to state history
          });
        }
      }

      // Mark command as completed
      await this.updateCommandStatus(command.id, 'completed');

      log(`✅ Command ${command.id} completed successfully`);
    } catch (error) {
      log(`❌ Error processing command ${command.id}:`, error);

      // Mark command as failed
      await this.updateCommandStatus(
        command.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  private async updateCommandStatus(
    commandId: string,
    status: 'processing' | 'completed' | 'failed',
    error?: string,
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
    };

    if (status === 'processing' || status === 'completed') {
      updates.processedAt = new Date();
    }

    if (error) {
      updates.error = error;
    }

    await db.update(Commands).set(updates).where(eq(Commands.id, commandId));
  }

  isRunning(): boolean {
    return this.running;
  }
}

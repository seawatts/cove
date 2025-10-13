/**
 * Device Command Processor
 * Subscribes to Supabase Realtime for device commands and executes them
 */

import { db } from '@cove/db/client';
import { DeviceCommands, Devices } from '@cove/db/schema';
import { createClient } from '@cove/db/supabase/server';
import { debug } from '@cove/logger';
import type { Device, DeviceCapability, ProtocolAdapter } from '@cove/types';
import { DeviceCapability as Capability, type ProtocolType } from '@cove/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';

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
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(adapters: Map<ProtocolType, ProtocolAdapter>) {
    this.adapters = adapters;
    this.supabase = createClient();
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
            table: 'deviceCommands',
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
      const pendingCommands = await db.query.DeviceCommands.findMany({
        limit: 100,
        orderBy: (commands, { asc }) => [asc(commands.createdAt)],
        where: eq(DeviceCommands.status, 'pending'),
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

      // Map capability string to enum
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

    await db
      .update(DeviceCommands)
      .set(updates)
      .where(eq(DeviceCommands.id, commandId));
  }

  isRunning(): boolean {
    return this.running;
  }
}

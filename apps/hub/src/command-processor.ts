/**
 * Entity Command Processor
 * Updated for Home Assistant-inspired entity-first architecture
 * Subscribes to Supabase Realtime for entity commands and executes them
 */

import { db } from '@cove/db/client';
import { device, entity } from '@cove/db/schema';
import { createClient } from '@cove/db/supabase/server';
import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import type {
  EntityAwareProtocolAdapter,
  ProtocolAdapter,
} from '@cove/protocols';
import { HubEventType, type ProtocolType } from '@cove/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import type { HubDatabase } from './db';
import type { DeviceEventCollector } from './events';

const log = debug('cove:hub:command-processor');

interface EntityCommand {
  id: string;
  entityId: string;
  capability: string;
  value: unknown;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export class CommandProcessor {
  private channel: RealtimeChannel | null = null;
  private running = false;
  private adapters: Map<ProtocolType, ProtocolAdapter>;
  private entityAwareAdapters: Map<ProtocolType, EntityAwareProtocolAdapter>;
  private supabase: ReturnType<typeof createClient>;
  private db: HubDatabase | null;
  private eventCollector: DeviceEventCollector | null;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    adapters: Map<ProtocolType, ProtocolAdapter>,
    options?: {
      db?: HubDatabase | null;
      eventCollector?: DeviceEventCollector | null;
      entityAwareAdapters?: Map<ProtocolType, EntityAwareProtocolAdapter>;
    },
  ) {
    this.adapters = adapters;
    this.entityAwareAdapters = options?.entityAwareAdapters || new Map();
    this.supabase = createClient();
    this.db = options?.db || null;
    this.eventCollector = options?.eventCollector || null;
    log('Entity command processor initialized');
  }

  async start(): Promise<void> {
    if (this.running) {
      log('Command processor already running');
      return;
    }

    log('Starting entity command processor');

    try {
      // Try to subscribe to Realtime for entity commands
      this.channel = this.supabase
        .channel('entity-commands')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            filter: 'status=eq.pending',
            schema: 'public',
            table: 'commands',
          },
          async (payload: { new: EntityCommand }) => {
            const command = payload.new;
            log('New entity command received via Realtime:', command);
            await this.processCommand(command);
          },
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            log('✅ Subscribed to entity commands channel (Realtime)');
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
    log('Entity command processor started');
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

    log('Stopping entity command processor');

    this.stopPolling();

    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.running = false;
    log('Entity command processor stopped');
  }

  private async processPendingCommands(): Promise<void> {
    try {
      // TODO: Implement commands table in schema
      // For now, we'll skip processing pending commands until the commands table is added
      log(
        'Commands table not yet implemented in schema - skipping pending commands',
      );

      /*
      const pendingCommands = await db.query.commands.findMany({
        limit: 100,
        orderBy: (commands, { asc }) => [asc(commands.createdAt)],
        where: eq(commands.status, 'pending'),
      });

      if (pendingCommands.length > 0) {
        log(`Found ${pendingCommands.length} pending commands`);
        for (const command of pendingCommands) {
          await this.processCommand(command as EntityCommand);
        }
      }
      */
    } catch (error) {
      log('Error processing pending commands:', error);
    }
  }

  private async processCommand(command: EntityCommand): Promise<void> {
    log(`Processing command ${command.id} for entity ${command.entityId}`);

    try {
      // Mark command as processing
      await this.updateCommandStatus(command.id, 'processing');

      // Get the entity and its device using Drizzle
      const entityResult = await db
        .select({
          device: {
            id: device.id,
            ipAddress: device.ipAddress,
            manufacturer: device.manufacturer,
            metadata: device.metadata,
            model: device.model,
            name: device.name,
            // TODO: Add protocol field to device table
            // protocol: device.protocol,
          },
          deviceId: entity.deviceId,
          id: entity.id,
          key: entity.key,
          kind: entity.kind,
          traits: entity.traits,
        })
        .from(entity)
        .innerJoin(device, eq(device.id, entity.deviceId))
        .where(eq(entity.id, command.entityId))
        .limit(1);

      if (entityResult.length === 0) {
        throw new Error(`Entity ${command.entityId} not found`);
      }

      const entityInfo = entityResult[0];
      if (!entityInfo) {
        throw new Error('Entity not found');
      }

      const deviceInfo = entityInfo.device;

      // TODO: Get protocol from device metadata until protocol field is added to device table
      const protocol =
        (deviceInfo.metadata?.protocol as ProtocolType) || 'esphome';
      const adapter = this.adapters.get(protocol);
      const entityAwareAdapter = this.entityAwareAdapters.get(protocol);

      if (!adapter) {
        throw new Error(`No adapter found for protocol: ${protocol}`);
      }

      if (!entityAwareAdapter) {
        throw new Error(
          `No entity-aware adapter found for protocol: ${protocol}`,
        );
      }

      // Execute the command using the entity-aware adapter
      const success = await entityAwareAdapter.sendEntityCommand(
        command.entityId,
        command.capability,
        command.value,
      );

      if (success) {
        // Mark command as completed
        await this.updateCommandStatus(command.id, 'completed');

        log(`✅ Command ${command.id} completed successfully`);

        this.eventCollector?.emit({
          eventType: HubEventType.CommandProcessed,
          message: `Entity command processed: ${command.entityId}`,
          metadata: {
            capability: command.capability,
            deviceName: deviceInfo.name,
            entityId: command.entityId,
            value: command.value,
          },
        });
      } else {
        throw new Error('Command execution failed');
      }
    } catch (error) {
      log(`❌ Command ${command.id} failed:`, error);

      // Mark command as failed
      await this.updateCommandStatus(command.id, 'failed');

      this.eventCollector?.emit({
        eventType: HubEventType.CommandFailed,
        message: `Entity command failed: ${command.entityId}`,
        metadata: {
          capability: command.capability,
          entityId: command.entityId,
          error: String(error),
          value: command.value,
        },
      });
    }
  }

  private async updateCommandStatus(
    commandId: string,
    status: 'processing' | 'completed' | 'failed',
  ): Promise<void> {
    try {
      // TODO: Implement commands table in schema
      log(
        `Would update command ${commandId} status to ${status} - commands table not yet implemented`,
      );

      /*
      await db
        .update(commands)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(commands.id, commandId));
      */
    } catch (error) {
      log('Error updating command status:', error);
    }
  }

  /**
   * Create a new entity command
   * TODO: Implement commands table in schema
   */
  async createCommand(
    _entityId: string,
    _capability: string,
    _value: unknown,
  ): Promise<string> {
    const commandId = createId({ prefix: 'cmd' });

    try {
      // TODO: Implement commands table in schema
      log(
        `Would create entity command: ${commandId} for ${_entityId} - commands table not yet implemented`,
      );

      /*
      await db.insert(commands).values({
        capability,
        createdAt: new Date(),
        entityId,
        id: commandId,
        status: 'pending',
        updatedAt: new Date(),
        value,
      });
      */

      log(`Created entity command: ${commandId} for ${_entityId}`);
      return commandId;
    } catch (error) {
      log('Error creating entity command:', error);
      throw error;
    }
  }

  /**
   * Get command status
   * TODO: Implement commands table in schema
   */
  async getCommandStatus(commandId: string): Promise<{
    id: string;
    entityId: string;
    capability: string;
    value: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      // TODO: Implement commands table in schema
      log(
        `Would get command status for ${commandId} - commands table not yet implemented`,
      );
      return null;

      /*
      const result = await db.query.commands.findFirst({
        where: eq(commands.id, commandId),
      });

      return result || null;
      */
    } catch (error) {
      log('Error getting command status:', error);
      return null;
    }
  }

  /**
   * Get statistics about command processing
   */
  getStats(): {
    running: boolean;
    adaptersCount: number;
    entityAwareAdaptersCount: number;
    hasRealtimeSubscription: boolean;
    isPolling: boolean;
  } {
    return {
      adaptersCount: this.adapters.size,
      entityAwareAdaptersCount: this.entityAwareAdapters.size,
      hasRealtimeSubscription: this.channel !== null,
      isPolling: this.pollingInterval !== null,
      running: this.running,
    };
  }
}

/**
 * Adapter Registry System
 * Manages protocol adapter registration and retrieval using plugin pattern
 */

import { debug } from '@cove/logger';
import type {
  EntityAwareProtocolAdapter,
  ProtocolAdapter,
} from '@cove/protocols';
import type { ProtocolType } from '@cove/types';
import type { HubDatabase } from '../db';
import type { StateManager } from '../state-manager';
import { ESPHomeAdapter } from './esphome';
import { HueAdapter } from './hue';

const log = debug('cove:hub:adapter-registry');

export interface AdapterRegistryOptions {
  db?: HubDatabase | null;
  stateManager?: StateManager | null;
  testMode?: boolean;
}

export class AdapterRegistry {
  private protocolAdapters: Map<ProtocolType, ProtocolAdapter> = new Map();
  private entityAwareAdapters: Map<ProtocolType, EntityAwareProtocolAdapter> =
    new Map();
  private db: HubDatabase | null;
  private stateManager: StateManager | null;
  private testMode: boolean;

  constructor(options: AdapterRegistryOptions = {}) {
    this.db = options.db || null;
    this.stateManager = options.stateManager || null;
    this.testMode = options.testMode || false;
    log('Adapter registry initialized');
  }

  /**
   * Register a protocol adapter
   */
  register(protocol: ProtocolType, adapter: ProtocolAdapter): void {
    this.protocolAdapters.set(protocol, adapter);

    // If adapter is entity-aware, register it separately
    if ('discoverEntities' in adapter && 'sendEntityCommand' in adapter) {
      this.entityAwareAdapters.set(
        protocol,
        adapter as EntityAwareProtocolAdapter,
      );
      log(`Registered entity-aware adapter for protocol: ${protocol}`);
    }

    log(`Registered adapter for protocol: ${protocol}`);
  }

  /**
   * Get a protocol adapter by protocol type
   */
  get(protocol: ProtocolType): ProtocolAdapter | undefined {
    return this.protocolAdapters.get(protocol);
  }

  /**
   * Get all registered protocol adapters
   */
  getAll(): Map<ProtocolType, ProtocolAdapter> {
    return new Map(this.protocolAdapters);
  }

  /**
   * Get entity-aware adapter by protocol type
   */
  getEntityAware(
    protocol: ProtocolType,
  ): EntityAwareProtocolAdapter | undefined {
    return this.entityAwareAdapters.get(protocol);
  }

  /**
   * Get all entity-aware adapters
   */
  getAllEntityAware(): Map<ProtocolType, EntityAwareProtocolAdapter> {
    return new Map(this.entityAwareAdapters);
  }

  /**
   * Check if adapter is registered for protocol
   */
  has(protocol: ProtocolType): boolean {
    return this.protocolAdapters.has(protocol);
  }

  /**
   * Check if entity-aware adapter is registered for protocol
   */
  hasEntityAware(protocol: ProtocolType): boolean {
    return this.entityAwareAdapters.has(protocol);
  }

  /**
   * Get list of registered protocol types
   */
  getRegisteredProtocols(): ProtocolType[] {
    return Array.from(this.protocolAdapters.keys());
  }

  /**
   * Get count of registered adapters
   */
  getAdapterCount(): number {
    return this.protocolAdapters.size;
  }

  /**
   * Get count of entity-aware adapters
   */
  getEntityAwareAdapterCount(): number {
    return this.entityAwareAdapters.size;
  }

  /**
   * Create and register default adapters
   */
  createDefaultAdapters(): void {
    log('Creating default adapters');
    log(`StateManager available: ${!!this.stateManager}`);
    log(`Database available: ${!!this.db}`);
    log(`Test mode: ${this.testMode}`);

    try {
      // Register ESPHome adapter
      if (this.stateManager && this.db) {
        const esphomeAdapter = new ESPHomeAdapter(
          this.stateManager,
          this.db,
          this.testMode,
        );
        this.register('esphome' as ProtocolType, esphomeAdapter);
        log('Registered ESPHome adapter');
      } else {
        log('Skipping ESPHome adapter - missing stateManager or db');
      }

      // Register Hue adapter
      if (this.stateManager && this.db) {
        const hueAdapter = new HueAdapter(
          this.stateManager,
          this.db,
          this.testMode,
        );
        this.register('hue' as ProtocolType, hueAdapter);
        log('Registered Hue adapter');
      } else {
        log('Skipping Hue adapter - missing stateManager or db');
      }

      // TODO: Register other adapters (Matter, Zigbee, etc.)

      log(`Created ${this.getAdapterCount()} default adapters`);
    } catch (error) {
      log('Failed to create default adapters:', error);
    }
  }

  /**
   * Initialize all registered adapters
   */
  async initializeAll(): Promise<void> {
    log('Initializing all adapters');

    for (const [protocol, adapter] of this.protocolAdapters.entries()) {
      try {
        await adapter.initialize();
        log(`Initialized ${protocol} adapter`);
      } catch (error) {
        log(`Failed to initialize ${protocol} adapter:`, error);
        throw error;
      }
    }

    log('All adapters initialized successfully');
  }

  /**
   * Shutdown all registered adapters
   */
  async shutdownAll(): Promise<void> {
    log('Shutting down all adapters');

    for (const [protocol, adapter] of this.protocolAdapters.entries()) {
      try {
        await adapter.shutdown();
        log(`Shut down ${protocol} adapter`);
      } catch (error) {
        log(`Error shutting down ${protocol} adapter:`, error);
      }
    }

    log('All adapters shut down');
  }

  /**
   * Clear all registered adapters
   */
  clear(): void {
    this.protocolAdapters.clear();
    this.entityAwareAdapters.clear();
    log('Cleared all adapters from registry');
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAdapters: number;
    entityAwareAdapters: number;
    registeredProtocols: string[];
  } {
    return {
      entityAwareAdapters: this.entityAwareAdapters.size,
      registeredProtocols: this.getRegisteredProtocols(),
      totalAdapters: this.protocolAdapters.size,
    };
  }
}

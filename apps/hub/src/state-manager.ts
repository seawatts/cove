/**
 * Entity-First State Management for Home Assistant++ Architecture
 * Handles entity state updates, thresholds, aggregation, and persistence
 *
 * Based on Home Assistant state management patterns:
 * - Entities are the primary state holders
 * - Latest state in entityState table (hot)
 * - History in entityStateHistory hypertable (cold)
 * - Intelligent filtering based on entity traits
 */

import { debug } from '@cove/logger';
import type { StateUpdate } from '@cove/types';
import type { HubDatabase } from './db';

const log = debug('cove:hub:state-manager');

// Sensor type classifications for filtering
export enum SensorType {
  Continuous = 'continuous', // Temp, CO2, Humidity - use thresholds
  Binary = 'binary', // Motion, Contact - only on change
  SlowChanging = 'slow_changing', // RSSI, Uptime - periodic sampling
  Event = 'event', // Buttons - always record
}

// Entity configuration for filtering
export interface EntityConfig {
  type: SensorType;
  threshold?: number; // For continuous sensors (change delta to trigger persist)
  unit?: string; // Display unit
  sampleInterval?: number; // For slow-changing (seconds between samples)
}

// Last known values for threshold comparison
interface LastValue {
  value: string;
  timestamp: Date;
}

// Default entity configurations by entity key pattern
const DEFAULT_ENTITY_CONFIGS: Record<string, EntityConfig> = {
  // Gas sensors from Apollo Air 1
  ammonia: { threshold: 0.1, type: SensorType.Continuous, unit: 'ppm' },
  // Light control
  brightness: { threshold: 5, type: SensorType.Continuous, unit: '%' },
  carbon_dioxide: { threshold: 5, type: SensorType.Continuous, unit: 'ppm' },
  carbon_monoxide: { threshold: 1, type: SensorType.Continuous, unit: 'ppm' },
  co2: { threshold: 5, type: SensorType.Continuous, unit: 'ppm' },
  color_temp: { threshold: 10, type: SensorType.Continuous, unit: 'mireds' },
  contact: { type: SensorType.Binary },
  door: { type: SensorType.Binary },
  esp_temperature: {
    sampleInterval: 300,
    type: SensorType.SlowChanging,
    unit: '°C',
  },
  ethanol: { threshold: 0.1, type: SensorType.Continuous, unit: 'ppm' },
  humidity: { threshold: 2, type: SensorType.Continuous, unit: '%' },
  hydrogen: { threshold: 0.1, type: SensorType.Continuous, unit: 'ppm' },
  methane: { threshold: 0.1, type: SensorType.Continuous, unit: 'ppm' },

  // Binary sensors - only on change
  motion: { type: SensorType.Binary },
  nitrogen_dioxide: {
    threshold: 0.1,
    type: SensorType.Continuous,
    unit: 'ppm',
  },
  nox: { threshold: 2, type: SensorType.Continuous, unit: 'index' },
  occupancy: { type: SensorType.Binary },
  on: { type: SensorType.Binary },
  pm_1: { threshold: 5, type: SensorType.Continuous, unit: 'µg/m³' },
  pm_2_5: { threshold: 5, type: SensorType.Continuous, unit: 'µg/m³' },
  pm_4: { threshold: 5, type: SensorType.Continuous, unit: 'µg/m³' },
  pm_10: { threshold: 5, type: SensorType.Continuous, unit: 'µg/m³' },
  pm1: { threshold: 5, type: SensorType.Continuous, unit: 'µg/m³' },
  pm2_5: { threshold: 5, type: SensorType.Continuous, unit: 'µg/m³' },
  pm4: { threshold: 5, type: SensorType.Continuous, unit: 'µg/m³' },
  pm10: { threshold: 5, type: SensorType.Continuous, unit: 'µg/m³' },
  presence: { type: SensorType.Binary },
  pressure: { threshold: 1, type: SensorType.Continuous, unit: 'hPa' },

  // Slow changing - periodic sampling
  rssi: { sampleInterval: 300, type: SensorType.SlowChanging, unit: 'dBm' },
  temp: { threshold: 0.5, type: SensorType.Continuous, unit: '°C' },
  // Environmental - continuous with thresholds
  temperature: { threshold: 0.5, type: SensorType.Continuous, unit: '°C' },
  uptime: { sampleInterval: 300, type: SensorType.SlowChanging, unit: 's' },
  voc: { threshold: 10, type: SensorType.Continuous, unit: 'index' },
  wifi_signal: {
    sampleInterval: 300,
    type: SensorType.SlowChanging,
    unit: '%',
  },
  window: { type: SensorType.Binary },
};

export class StateManager {
  private db: HubDatabase | null;
  private lastValues: Map<string, LastValue> = new Map(); // entityId -> LastValue
  private entityConfigs: Map<string, EntityConfig> = new Map();
  private stats = {
    filtered: 0,
    persisted: 0,
    totalUpdates: 0,
  };

  constructor(db?: HubDatabase | null) {
    this.db = db || null;
    this.initializeEntityConfigs();
  }

  private initializeEntityConfigs(): void {
    // Load default configs
    for (const [key, config] of Object.entries(DEFAULT_ENTITY_CONFIGS)) {
      this.entityConfigs.set(key, config);
    }
    log(`Initialized ${this.entityConfigs.size} default entity configurations`);
  }

  /**
   * Register custom entity configuration
   */
  registerEntityConfig(entityKey: string, config: EntityConfig): void {
    this.entityConfigs.set(entityKey, config);
    log(`Registered custom config for ${entityKey}:`, config);
  }

  /**
   * Get entity config by entity key or pattern matching
   */
  private getEntityConfig(entityKey: string): EntityConfig {
    // Direct match
    if (this.entityConfigs.has(entityKey)) {
      const config = this.entityConfigs.get(entityKey);
      if (config) return config;
    }

    // Pattern matching (e.g., "sensor.temperature_living_room" matches "temperature")
    for (const [pattern, config] of this.entityConfigs.entries()) {
      if (entityKey.toLowerCase().includes(pattern)) {
        return config;
      }
    }

    // Default: treat as continuous with no threshold (always record)
    return { threshold: 0, type: SensorType.Continuous };
  }

  /**
   * Main method: Process entity state update with intelligent filtering
   */
  async updateState(update: StateUpdate): Promise<boolean> {
    this.stats.totalUpdates++;

    const { entityId, state, attrs, timestamp } = update;
    const config = this.getEntityConfig(entityId);
    const lastValue = this.lastValues.get(entityId);
    const now = timestamp || new Date();

    // Apply filtering logic based on entity type
    let shouldPersist = false;
    let reason = '';

    switch (config.type) {
      case SensorType.Binary: {
        // Only persist if value changed
        shouldPersist = !lastValue || lastValue.value !== state;
        reason = shouldPersist ? 'state changed' : 'state unchanged';
        break;
      }

      case SensorType.Continuous: {
        // Persist if threshold exceeded or no previous value
        if (!lastValue) {
          shouldPersist = true;
          reason = 'first value';
        } else if (
          typeof state === 'string' &&
          typeof lastValue.value === 'string'
        ) {
          // Try to parse as numbers for threshold comparison
          const currentNum = Number.parseFloat(state);
          const lastNum = Number.parseFloat(lastValue.value);

          if (!Number.isNaN(currentNum) && !Number.isNaN(lastNum)) {
            const delta = Math.abs(currentNum - lastNum);
            shouldPersist = config.threshold ? delta >= config.threshold : true;
            reason = shouldPersist
              ? `threshold exceeded (Δ${delta.toFixed(2)})`
              : `below threshold (Δ${delta.toFixed(2)} < ${config.threshold})`;
          } else {
            // Non-numeric continuous (e.g., text sensors)
            shouldPersist = state !== lastValue.value;
            reason = shouldPersist ? 'value changed' : 'value unchanged';
          }
        } else {
          // Non-numeric continuous
          shouldPersist = state !== lastValue.value;
          reason = shouldPersist ? 'value changed' : 'value unchanged';
        }
        break;
      }

      case SensorType.SlowChanging: {
        // Only persist if sample interval elapsed
        if (!lastValue) {
          shouldPersist = true;
          reason = 'first value';
        } else {
          const elapsed =
            (now.getTime() - lastValue.timestamp.getTime()) / 1000;
          shouldPersist = elapsed >= (config.sampleInterval || 300);
          reason = shouldPersist
            ? `interval elapsed (${elapsed.toFixed(0)}s)`
            : `interval not elapsed (${elapsed.toFixed(0)}s < ${config.sampleInterval}s)`;
        }
        break;
      }

      case SensorType.Event: {
        // Always persist events
        shouldPersist = true;
        reason = 'event';
        break;
      }
    }

    // Log filtering decision
    if (shouldPersist) {
      log(
        `✓ ${entityId}: ${state}${config.unit ? ` ${config.unit}` : ''} (${reason})`,
      );
      this.stats.persisted++;
    } else {
      log(
        `✗ ${entityId}: ${state}${config.unit ? ` ${config.unit}` : ''} (filtered: ${reason})`,
      );
      this.stats.filtered++;
    }

    // Persist to database if needed
    if (shouldPersist && this.db) {
      const success = await this.persistStateChange({
        attrs,
        config,
        entityId,
        state,
        timestamp: now,
      });

      if (success) {
        // Update last value
        this.lastValues.set(entityId, { timestamp: now, value: state });
      }

      return success;
    }

    return false; // Not persisted (filtered out)
  }

  /**
   * Persist state change to database (both entityState and entityStateHistory)
   */
  private async persistStateChange(params: {
    entityId: string;
    state: string;
    attrs?: Record<string, unknown>;
    timestamp: Date;
    config: EntityConfig;
  }): Promise<boolean> {
    try {
      const { entityId, state, attrs, timestamp } = params;

      // Update latest state in entityState table (upsert)
      const success = await this.db?.upsertEntityState({
        attrs,
        entityId,
        state,
      });

      if (!success) {
        log(`Failed to update entityState for ${entityId}`);
        return false;
      }

      // Append to history in entityStateHistory table
      // Note: We need homeId for the history table - this should be passed from the caller
      // For now, we'll need to get it from the entity's device's home
      const entityWithDevice = await this.db?.getEntityWithDevice(entityId);
      if (!entityWithDevice) {
        log(`Failed to get entity with device for ${entityId}`);
        return false;
      }

      const historySuccess = await this.db?.insertEntityStateHistory({
        attrs,
        entityId,
        homeId: entityWithDevice.device.homeId,
        state,
        timestamp,
      });

      if (!historySuccess) {
        log(`Failed to insert entityStateHistory for ${entityId}`);
        return false;
      }

      return true;
    } catch (error) {
      log('Error persisting state change:', error);
      return false;
    }
  }

  /**
   * Clear cached state for an entity (on disconnect)
   */
  clearEntityState(entityId: string): void {
    this.lastValues.delete(entityId);
    log(`Cleared state cache for entity: ${entityId}`);
  }

  /**
   * Get statistics about filtering efficiency
   */
  getStats(): {
    entitiesTracked: number;
    configuredEntities: number;
    totalUpdates: number;
    persisted: number;
    filtered: number;
    filterRate: string;
  } {
    const filterRate =
      this.stats.totalUpdates > 0
        ? `${((this.stats.filtered / this.stats.totalUpdates) * 100).toFixed(1)}%`
        : '0%';

    return {
      configuredEntities: this.entityConfigs.size,
      entitiesTracked: this.lastValues.size,
      filtered: this.stats.filtered,
      filterRate,
      persisted: this.stats.persisted,
      totalUpdates: this.stats.totalUpdates,
    };
  }

  /**
   * Log statistics
   */
  logStats(): void {
    const stats = this.getStats();
    log('StateManager Statistics:');
    log(`  Entities tracked: ${stats.entitiesTracked}`);
    log(`  Total updates: ${stats.totalUpdates}`);
    log(`  Persisted: ${stats.persisted}`);
    log(`  Filtered: ${stats.filtered} (${stats.filterRate})`);
  }
}

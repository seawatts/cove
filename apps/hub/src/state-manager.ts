/**
 * Centralized State Management for All Protocol Adapters
 * Handles delta storage, thresholds, aggregation, and persistence
 *
 * Industry-standard approach based on research:
 * - Time-series database patterns (InfluxDB, TimescaleDB)
 * - Home Assistant state management
 * - IoT sensor data best practices
 */

import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import type { DeviceStateHistory } from '@cove/types';
import type { SupabaseSync } from './supabase';

const log = debug('cove:hub:state-manager');

// Sensor type classifications
export enum SensorType {
  Continuous = 'continuous', // Temp, CO2, Humidity - use thresholds
  Binary = 'binary', // Motion, Contact - only on change
  SlowChanging = 'slow_changing', // RSSI, Uptime - periodic sampling
  Event = 'event', // Buttons - always record
}

// Sensor configuration
export interface SensorConfig {
  type: SensorType;
  threshold?: number; // For continuous sensors (change delta to trigger persist)
  unit?: string; // Display unit
  sampleInterval?: number; // For slow-changing (seconds between samples)
}

// State update payload
export interface StateUpdate {
  deviceId: string;
  stateKey: string;
  value: unknown;
  entityName: string;
  source: string; // 'esphome', 'hue', 'sonos', etc.
  timestamp?: Date;
}

// Last known values for threshold comparison
interface LastValue {
  value: unknown;
  timestamp: Date;
}

// Default sensor configurations by name pattern
const DEFAULT_SENSOR_CONFIGS: Record<string, SensorConfig> = {
  // Gas sensors from Apollo Air 1
  ammonia: { threshold: 0.1, type: SensorType.Continuous, unit: 'ppm' },
  // Light control
  brightness: { threshold: 5, type: SensorType.Continuous, unit: '%' },
  carbon_dioxide: { threshold: 5, type: SensorType.Continuous, unit: 'ppm' },
  carbon_monoxide: { threshold: 1, type: SensorType.Continuous, unit: 'ppm' },
  co2: { threshold: 5, type: SensorType.Continuous, unit: 'ppm' }, // Lower threshold for more frequent updates
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
  rssi: { sampleInterval: 300, type: SensorType.SlowChanging, unit: 'dBm' }, // 5min
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
  private supabaseSync: SupabaseSync | null;
  private lastValues: Map<string, LastValue> = new Map(); // deviceId:stateKey -> LastValue
  private sensorConfigs: Map<string, SensorConfig> = new Map();
  private deviceStates: Map<string, Record<string, unknown>> = new Map(); // In-memory device states
  private stats = {
    filtered: 0,
    persisted: 0,
    totalUpdates: 0,
  };

  constructor(supabaseSync?: SupabaseSync | null) {
    this.supabaseSync = supabaseSync || null;
    this.initializeSensorConfigs();
  }

  private initializeSensorConfigs(): void {
    // Load default configs
    for (const [key, config] of Object.entries(DEFAULT_SENSOR_CONFIGS)) {
      this.sensorConfigs.set(key, config);
    }
    log(`Initialized ${this.sensorConfigs.size} default sensor configurations`);
  }

  /**
   * Register custom sensor configuration
   */
  registerSensorConfig(stateKey: string, config: SensorConfig): void {
    this.sensorConfigs.set(stateKey, config);
    log(`Registered custom config for ${stateKey}:`, config);
  }

  /**
   * Get sensor config by state key or pattern matching
   */
  private getSensorConfig(stateKey: string): SensorConfig {
    // Direct match
    if (this.sensorConfigs.has(stateKey)) {
      const config = this.sensorConfigs.get(stateKey);
      if (config) return config;
    }

    // Pattern matching (e.g., "sen55_temperature" matches "temperature")
    for (const [pattern, config] of this.sensorConfigs.entries()) {
      if (stateKey.toLowerCase().includes(pattern)) {
        return config;
      }
    }

    // Default: treat as continuous with no threshold (always record)
    return { threshold: 0, type: SensorType.Continuous };
  }

  /**
   * Main method: Process state update with intelligent filtering
   */
  async updateState(update: StateUpdate): Promise<boolean> {
    this.stats.totalUpdates++;

    const { deviceId, stateKey, value, entityName, source, timestamp } = update;
    const config = this.getSensorConfig(stateKey);
    const lastValueKey = `${deviceId}:${stateKey}`;
    const lastValue = this.lastValues.get(lastValueKey);
    const now = timestamp || new Date();

    // Update in-memory device state
    const deviceState = this.deviceStates.get(deviceId) || {};
    deviceState[stateKey] = value;
    this.deviceStates.set(deviceId, deviceState);

    // Apply filtering logic based on sensor type
    let shouldPersist = false;
    let reason = '';

    switch (config.type) {
      case SensorType.Binary: {
        // Only persist if value changed
        shouldPersist = !lastValue || lastValue.value !== value;
        reason = shouldPersist ? 'state changed' : 'state unchanged';
        break;
      }

      case SensorType.Continuous: {
        // Persist if threshold exceeded or no previous value
        if (!lastValue) {
          shouldPersist = true;
          reason = 'first value';
        } else if (
          typeof value === 'number' &&
          typeof lastValue.value === 'number'
        ) {
          const delta = Math.abs(value - lastValue.value);
          shouldPersist = config.threshold ? delta >= config.threshold : true;
          reason = shouldPersist
            ? `threshold exceeded (Δ${delta.toFixed(2)})`
            : `below threshold (Δ${delta.toFixed(2)} < ${config.threshold})`;
        } else {
          // Non-numeric continuous (e.g., text sensors)
          shouldPersist = value !== lastValue.value;
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
        `✓ ${entityName}: ${value}${config.unit ? ` ${config.unit}` : ''} (${reason})`,
      );
      this.stats.persisted++;
    } else {
      log(
        `✗ ${entityName}: ${value}${config.unit ? ` ${config.unit}` : ''} (filtered: ${reason})`,
      );
      this.stats.filtered++;
    }

    // Persist to database if needed
    if (shouldPersist && this.supabaseSync) {
      const success = await this.persistStateChange({
        deviceId,
        entityName,
        sensorType: config.type,
        source,
        stateKey,
        timestamp: now,
        unit: config.unit,
        value,
      });

      if (success) {
        // Update last value
        this.lastValues.set(lastValueKey, { timestamp: now, value });
      }

      return success;
    }

    return false; // Not persisted (filtered out)
  }

  /**
   * Persist state change to database (delta storage)
   */
  private async persistStateChange(params: {
    deviceId: string;
    stateKey: string;
    value: unknown;
    entityName: string;
    source: string;
    timestamp: Date;
    unit?: string;
    sensorType?: SensorType;
  }): Promise<boolean> {
    try {
      const {
        deviceId,
        stateKey,
        value,
        entityName,
        source,
        timestamp,
        unit,
        sensorType,
      } = params;

      // Update device record with latest state
      const deviceState = this.deviceStates.get(deviceId);
      if (deviceState) {
        await this.supabaseSync?.updateDeviceState(deviceId, deviceState);
      }

      // Create state history record (delta only)
      const stateHistory: DeviceStateHistory = {
        attributes: {
          entityName,
          sensorType,
          source,
          stateKey,
          unit,
        },
        deviceId,
        id: createId({ prefix: 'state' }),
        lastChanged: timestamp,
        lastUpdated: timestamp,
        state: value, // Just the value, not full state object
      };

      const success = await this.supabaseSync?.insertStateHistory(stateHistory);

      if (!success) {
        log(`Failed to persist state for ${entityName}`);
      }

      return success ?? false;
    } catch (error) {
      log('Error persisting state change:', error);
      return false;
    }
  }

  /**
   * Get current in-memory state for a device
   */
  getDeviceState(deviceId: string): Record<string, unknown> {
    return this.deviceStates.get(deviceId) || {};
  }

  /**
   * Update full device state (useful for initial sync)
   */
  setDeviceState(deviceId: string, state: Record<string, unknown>): void {
    this.deviceStates.set(deviceId, state);
  }

  /**
   * Clear cached state for a device (on disconnect)
   */
  clearDeviceState(deviceId: string): void {
    this.deviceStates.delete(deviceId);

    // Clear last values for this device
    for (const key of this.lastValues.keys()) {
      if (key.startsWith(`${deviceId}:`)) {
        this.lastValues.delete(key);
      }
    }

    log(`Cleared state cache for device: ${deviceId}`);
  }

  /**
   * Get statistics about filtering efficiency
   */
  getStats(): {
    devicesTracked: number;
    sensorsTracked: number;
    configuredSensors: number;
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
      configuredSensors: this.sensorConfigs.size,
      devicesTracked: this.deviceStates.size,
      filtered: this.stats.filtered,
      filterRate,
      persisted: this.stats.persisted,
      sensorsTracked: this.lastValues.size,
      totalUpdates: this.stats.totalUpdates,
    };
  }

  /**
   * Log statistics
   */
  logStats(): void {
    const stats = this.getStats();
    log('StateManager Statistics:');
    log(`  Devices tracked: ${stats.devicesTracked}`);
    log(`  Sensors tracked: ${stats.sensorsTracked}`);
    log(`  Total updates: ${stats.totalUpdates}`);
    log(`  Persisted: ${stats.persisted}`);
    log(`  Filtered: ${stats.filtered} (${stats.filterRate})`);
  }
}

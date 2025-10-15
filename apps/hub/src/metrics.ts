/**
 * Device Metrics Collector
 * Gathers system metrics for performance monitoring
 * Works for hub devices, storing state changes in DeviceStateHistory table
 * Follows Home Assistant pattern where state changes are the history
 */

import { cpus, freemem, totalmem } from 'node:os';
import { createId } from '@cove/id';
import { debug } from '@cove/logger';
import type { DeviceStateHistory } from '@cove/types';
import type { SupabaseSync } from './supabase';

const log = debug('cove:hub:metrics');

interface MetricsCollectorOptions {
  deviceId: string; // Hub's device ID
  supabaseSync?: SupabaseSync | null;
  bufferSize?: number;
  collectionInterval?: number; // seconds
  syncInterval?: number; // seconds
}

interface HubState {
  // System metrics
  cpu_usage: number;
  memory_used: number;
  memory_total: number;
  memory_free: number;
  memory_percent: number;
  uptime: number;
  // Hub-specific metrics
  connected_devices: number;
  active_protocols: number;
  // Metadata
  timestamp: number;
}

export class DeviceMetricsCollector {
  private deviceId: string;
  private supabaseSync: SupabaseSync | null;
  private stateHistoryBuffer: DeviceStateHistory[] = [];
  private bufferSize: number;
  private collectionInterval: number;
  private syncInterval: number;
  private collectionTimer: Timer | null = null;
  private syncTimer: Timer | null = null;
  private startTime: number = Date.now();
  private connectedDevicesCount = 0;
  private activeProtocolsCount = 0;
  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = Date.now();
  private lastState: HubState | null = null;

  constructor(options: MetricsCollectorOptions) {
    this.deviceId = options.deviceId;
    this.supabaseSync = options.supabaseSync || null;
    this.bufferSize = options.bufferSize || 100; // ~16 minutes at 10s intervals
    this.collectionInterval = options.collectionInterval || 10; // 10 seconds default
    this.syncInterval = options.syncInterval || 60; // 60 seconds default
  }

  /**
   * Start metrics collection
   */
  start(): void {
    log('Starting metrics collector');

    // Collect metrics immediately
    this.collectMetrics();

    // Start collection timer
    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.collectionInterval * 1000);

    // Start sync timer if Supabase is enabled
    if (this.supabaseSync) {
      this.syncTimer = setInterval(() => {
        this.syncMetrics();
      }, this.syncInterval * 1000);
    }
  }

  /**
   * Stop metrics collection and sync remaining metrics
   */
  async stop(): Promise<void> {
    log('Stopping metrics collector');

    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    // Final sync before stopping
    if (this.supabaseSync && this.stateHistoryBuffer.length > 0) {
      await this.syncMetrics();
    }
  }

  /**
   * Update connected devices count
   */
  setConnectedDevices(count: number): void {
    this.connectedDevicesCount = count;
  }

  /**
   * Update active protocols count
   */
  setActiveProtocols(count: number): void {
    this.activeProtocolsCount = count;
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuUsage(): number {
    const currentUsage = process.cpuUsage(this.lastCpuUsage);
    const currentTime = Date.now();
    const elapsedTime = currentTime - this.lastCpuTime;

    // CPU time in microseconds
    const cpuTime = (currentUsage.user + currentUsage.system) / 1000; // Convert to milliseconds

    // Calculate percentage
    const cpuCount = cpus().length;
    const usage = ((cpuTime / elapsedTime) * 100) / cpuCount;

    // Update for next calculation
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = currentTime;

    return Math.min(Math.max(usage, 0), 100); // Clamp between 0-100
  }

  /**
   * Collect current system metrics as a state snapshot
   * Follows Home Assistant pattern: state changes are recorded as history
   */
  private collectMetrics(): void {
    const totalMem = totalmem();
    const freeMem = freemem();
    const usedMem = totalMem - freeMem;
    const cpuUsage = this.calculateCpuUsage();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const now = new Date();

    // Create a full state snapshot
    const currentState: HubState = {
      active_protocols: this.activeProtocolsCount,
      connected_devices: this.connectedDevicesCount,
      cpu_usage: Number.parseFloat(cpuUsage.toFixed(2)),
      memory_free: Math.floor(freeMem / 1024 / 1024),
      memory_percent: Number.parseFloat(
        ((usedMem / totalMem) * 100).toFixed(2),
      ),
      memory_total: Math.floor(totalMem / 1024 / 1024),
      memory_used: Math.floor(usedMem / 1024 / 1024),
      timestamp: Date.now(),
      uptime,
    };

    // Only record if state has changed significantly or it's been a while
    // This reduces unnecessary writes while ensuring we capture trends
    const shouldRecord =
      !this.lastState ||
      Math.abs(currentState.cpu_usage - this.lastState.cpu_usage) > 5 ||
      Math.abs(currentState.memory_used - this.lastState.memory_used) > 100 ||
      currentState.connected_devices !== this.lastState.connected_devices ||
      currentState.active_protocols !== this.lastState.active_protocols ||
      Date.now() - this.lastState.timestamp > 60000; // Force record every minute

    if (shouldRecord) {
      const stateHistory: DeviceStateHistory = {
        attributes: {
          collection_interval: this.collectionInterval,
          units: {
            cpu_usage: '%',
            memory_free: 'MB',
            memory_total: 'MB',
            memory_used: 'MB',
            uptime: 's',
          },
        },
        deviceId: this.deviceId,
        id: createId({ prefix: 'state' }),
        lastChanged: now,
        lastUpdated: now,
        state: currentState as unknown as Record<string, unknown>,
      };

      this.stateHistoryBuffer.push(stateHistory);
      this.lastState = currentState;

      // Maintain buffer size limit
      while (this.stateHistoryBuffer.length > this.bufferSize) {
        this.stateHistoryBuffer.shift();
      }

      log(
        `Recorded state: CPU ${cpuUsage.toFixed(1)}%, Memory ${currentState.memory_used}MB/${currentState.memory_total}MB, Devices ${this.connectedDevicesCount}`,
      );
    }
  }

  /**
   * Sync state history to Supabase
   */
  private async syncMetrics(): Promise<void> {
    if (!this.supabaseSync || this.stateHistoryBuffer.length === 0) {
      return;
    }

    const statesToSync = [...this.stateHistoryBuffer];

    try {
      log(`Syncing ${statesToSync.length} state history records to Supabase`);
      const success =
        await this.supabaseSync.insertStateHistoryBatch(statesToSync);

      if (success) {
        // Clear synced states from buffer
        this.stateHistoryBuffer = [];
        log(`Successfully synced ${statesToSync.length} state history records`);
      } else {
        log('Failed to sync state history, will retry next interval');
      }
    } catch (error) {
      log('Error syncing state history:', error);
      // States remain in buffer for retry
    }
  }

  /**
   * Get recent state history from buffer
   */
  getRecentStateHistory(options?: {
    limit?: number;
    since?: Date;
  }): DeviceStateHistory[] {
    let states = [...this.stateHistoryBuffer];

    // Filter by timestamp
    if (options?.since) {
      states = states.filter((s) => s.lastChanged >= (options.since as Date));
    }

    // Sort by timestamp descending (most recent first)
    states.sort((a, b) => b.lastChanged.getTime() - a.lastChanged.getTime());

    // Limit results
    if (options?.limit) {
      states = states.slice(0, options.limit);
    }

    return states;
  }

  /**
   * Get current state (most recent)
   */
  getCurrentState(): HubState | null {
    return this.lastState;
  }

  /**
   * Get latest state from buffer
   */
  getLatestState(): DeviceStateHistory | null {
    if (this.stateHistoryBuffer.length === 0) {
      return null;
    }
    return this.stateHistoryBuffer.at(-1) || null;
  }

  /**
   * Get average value for a specific metric field
   */
  getAverageMetric(field: keyof HubState): number | null {
    if (this.stateHistoryBuffer.length === 0) {
      return null;
    }

    const values = this.stateHistoryBuffer
      .map((s) => {
        const state = s.state as unknown as HubState;
        return state[field];
      })
      .filter((v) => typeof v === 'number');

    if (values.length === 0) {
      return null;
    }

    const sum = values.reduce((acc, v) => acc + v, 0);
    return sum / values.length;
  }

  /**
   * Clear all state history from buffer
   */
  clearBuffer(): void {
    this.stateHistoryBuffer = [];
    log('State history buffer cleared');
  }
}

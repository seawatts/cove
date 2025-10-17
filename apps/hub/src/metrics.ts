/**
 * Device Metrics Collector
 * Gathers system metrics for performance monitoring
 * Works for hub devices, storing state changes in DeviceStateHistory table
 * Follows Home Assistant pattern where state changes are the history
 */

import { cpus, freemem, totalmem } from 'node:os';
import { debug } from '@cove/logger';
import type { HubDatabase } from './db';

const log = debug('cove:hub:metrics');

interface MetricsCollectorOptions {
  deviceId: string; // Hub's device ID
  db?: HubDatabase | null;
  bufferSize?: number;
  collectionInterval?: number; // seconds
  syncInterval?: number; // seconds
}

interface HubMetrics {
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
  private db: HubDatabase | null;
  private metricsBuffer: HubMetrics[] = [];
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
  private lastMetrics: HubMetrics | null = null;
  private sensorEntityIds: Map<string, string> = new Map(); // metric name -> entity ID

  constructor(options: MetricsCollectorOptions) {
    this.deviceId = options.deviceId;
    this.db = options.db || null;
    this.bufferSize = options.bufferSize || 100; // ~16 minutes at 10s intervals
    this.collectionInterval = options.collectionInterval || 10; // 10 seconds default
    this.syncInterval = options.syncInterval || 60; // 60 seconds default
  }

  /**
   * Start metrics collection
   */
  async start(): Promise<void> {
    log('Starting metrics collector');

    // Initialize sensor entities for each metric
    await this.initializeSensorEntities();

    // Collect metrics immediately
    await this.collectMetrics();

    // Start collection timer
    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.collectionInterval * 1000);

    // Start sync timer if database is enabled
    if (this.db) {
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
    if (this.db && this.metricsBuffer.length > 0) {
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
   * Initialize sensor entities for each metric
   */
  private async initializeSensorEntities(): Promise<void> {
    if (!this.db) {
      log('No database connection, skipping sensor entity initialization');
      return;
    }

    const metrics = [
      { deviceClass: 'cpu', name: 'cpu_usage', unit: '%' },
      { deviceClass: 'memory', name: 'memory_used', unit: 'MB' },
      { deviceClass: 'memory', name: 'memory_total', unit: 'MB' },
      { deviceClass: 'memory', name: 'memory_free', unit: 'MB' },
      { deviceClass: 'memory', name: 'memory_percent', unit: '%' },
      { deviceClass: 'duration', name: 'uptime', unit: 's' },
      { deviceClass: 'count', name: 'connected_devices', unit: 'devices' },
      { deviceClass: 'count', name: 'active_protocols', unit: 'protocols' },
    ];

    for (const metric of metrics) {
      const entityKey = `sensor.hub_${metric.name}`;
      const entityId = await this.db.createEntity({
        deviceId: this.deviceId,
        key: entityKey,
        kind: 'sensor',
        traits: {
          device_class: metric.deviceClass,
          source: 'hub_metrics',
          unit_of_measurement: metric.unit,
        },
      });

      if (entityId) {
        this.sensorEntityIds.set(metric.name, entityId);
        log(`Created sensor entity for ${metric.name}: ${entityId}`);
      }
    }
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
   * Collect current system metrics as entity state updates
   * Follows Home Assistant pattern: metrics are sensor entities with state history
   */
  private async collectMetrics(): Promise<void> {
    const totalMem = totalmem();
    const freeMem = freemem();
    const usedMem = totalMem - freeMem;
    const cpuUsage = this.calculateCpuUsage();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const now = new Date();

    // Create a full metrics snapshot
    const currentMetrics: HubMetrics = {
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

    // Only record if metrics have changed significantly or it's been a while
    const shouldRecord =
      !this.lastMetrics ||
      Math.abs(currentMetrics.cpu_usage - this.lastMetrics.cpu_usage) > 5 ||
      Math.abs(currentMetrics.memory_used - this.lastMetrics.memory_used) >
        100 ||
      currentMetrics.connected_devices !== this.lastMetrics.connected_devices ||
      currentMetrics.active_protocols !== this.lastMetrics.active_protocols ||
      Date.now() - this.lastMetrics.timestamp > 60000; // Force record every minute

    if (shouldRecord) {
      // Update each sensor entity with its current value
      for (const [metricName, entityId] of this.sensorEntityIds.entries()) {
        const value = currentMetrics[metricName as keyof HubMetrics];

        if (typeof value === 'number') {
          // Update entity state
          await this.db?.upsertEntityState({
            attrs: {
              device_class: this.getMetricDeviceClass(metricName),
              source: 'hub_metrics',
              unit_of_measurement: this.getMetricUnit(metricName),
            },
            entityId,
            state: value.toString(),
          });

          // Insert state history
          await this.db?.insertEntityStateHistory({
            attrs: {
              device_class: this.getMetricDeviceClass(metricName),
              source: 'hub_metrics',
              unit_of_measurement: this.getMetricUnit(metricName),
            },
            entityId,
            homeId: this.deviceId, // TODO: Get actual home ID
            state: value.toString(),
            timestamp: now,
          });
        }
      }

      this.metricsBuffer.push(currentMetrics);
      this.lastMetrics = currentMetrics;

      // Maintain buffer size limit
      while (this.metricsBuffer.length > this.bufferSize) {
        this.metricsBuffer.shift();
      }

      log(
        `Recorded metrics: CPU ${cpuUsage.toFixed(1)}%, Memory ${currentMetrics.memory_used}MB/${currentMetrics.memory_total}MB, Devices ${this.connectedDevicesCount}`,
      );
    }
  }

  /**
   * Get unit of measurement for a metric
   */
  private getMetricUnit(metricName: string): string {
    const units: Record<string, string> = {
      active_protocols: 'protocols',
      connected_devices: 'devices',
      cpu_usage: '%',
      memory_free: 'MB',
      memory_percent: '%',
      memory_total: 'MB',
      memory_used: 'MB',
      uptime: 's',
    };
    return units[metricName] || '';
  }

  /**
   * Get device class for a metric
   */
  private getMetricDeviceClass(metricName: string): string {
    const deviceClasses: Record<string, string> = {
      active_protocols: 'count',
      connected_devices: 'count',
      cpu_usage: 'cpu',
      memory_free: 'memory',
      memory_percent: 'memory',
      memory_total: 'memory',
      memory_used: 'memory',
      uptime: 'duration',
    };
    return deviceClasses[metricName] || '';
  }

  /**
   * Sync metrics to database (no-op since we're using entity state history)
   */
  private async syncMetrics(): Promise<void> {
    // Metrics are already persisted as entity state history in collectMetrics()
    // This method is kept for compatibility but does nothing
    log('Metrics sync completed (using entity state history pattern)');
  }

  /**
   * Get recent metrics from buffer
   */
  getRecentMetrics(options?: { limit?: number; since?: Date }): HubMetrics[] {
    let metrics = [...this.metricsBuffer];

    // Filter by timestamp
    if (options?.since) {
      const sinceTime = options.since.getTime();
      metrics = metrics.filter((m) => m.timestamp >= sinceTime);
    }

    // Sort by timestamp descending (most recent first)
    metrics.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    if (options?.limit) {
      metrics = metrics.slice(0, options.limit);
    }

    return metrics;
  }

  /**
   * Get current metrics (most recent)
   */
  getCurrentMetrics(): HubMetrics | null {
    return this.lastMetrics;
  }

  /**
   * Get latest metrics from buffer
   */
  getLatestMetrics(): HubMetrics | null {
    if (this.metricsBuffer.length === 0) {
      return null;
    }
    return this.metricsBuffer.at(-1) || null;
  }

  /**
   * Get average value for a specific metric field
   */
  getAverageMetric(field: keyof HubMetrics): number | null {
    if (this.metricsBuffer.length === 0) {
      return null;
    }

    const values = this.metricsBuffer
      .map((m) => m[field])
      .filter((v) => typeof v === 'number');

    if (values.length === 0) {
      return null;
    }

    const sum = values.reduce((acc, v) => acc + v, 0);
    return sum / values.length;
  }

  /**
   * Clear all metrics from buffer
   */
  clearBuffer(): void {
    this.metricsBuffer = [];
    log('Metrics buffer cleared');
  }
}

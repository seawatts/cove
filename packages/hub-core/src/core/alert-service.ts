/**
 * AlertService - Alert evaluation and management for Hub V2
 * Monitors telemetry data and triggers alerts based on configured rules
 */

import { alertConfigs, alertHistory } from '@cove/db/hub';
import type { HubDatabaseClient as DatabaseClient } from '@cove/db/hub/server';
import { createId } from '@cove/id';
import { debug, info, error as logError } from '@cove/logger';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AlertEvent, EventBus } from './event-bus';

const logDebug = debug('cove:hub-v2:alert-service');
const logInfo = info('cove:hub-v2:alert-service');
const logErr = logError('cove:hub-v2:alert-service');

export interface AlertServiceOptions {
  db: DatabaseClient;
  eventBus: EventBus;
}

interface AlertConfigData {
  id: string;
  entityId: string;
  homeId: string;
  name: string;
  enabled: boolean;
  severity: 'info' | 'warning' | 'critical';
  alertType: 'threshold' | 'range' | 'rate_of_change';
  field: string;
  showInGraph: boolean;
  thresholdValue?: number | null;
  thresholdOperator?: string | null;
  rangeMin?: number | null;
  rangeMax?: number | null;
  rateWindow?: number | null;
  rateThreshold?: number | null;
}

interface RateOfChangeTracking {
  values: Array<{ timestamp: number; value: number }>;
  lastEvaluation: number;
}

interface ActiveAlert {
  historyId: string;
  configId: string;
  entityId: string;
  field: string;
  triggeredAt: Date;
}

/**
 * AlertService class
 */
export class AlertService {
  private db: DatabaseClient;
  private eventBus: EventBus;
  private alertConfigsCache = new Map<string, AlertConfigData[]>();
  private activeAlerts = new Map<string, ActiveAlert>();
  private rateOfChangeData = new Map<string, RateOfChangeTracking>();
  private readonly CACHE_TTL = 60000; // 1 minute
  private cacheTimestamp = 0;

  constructor(options: AlertServiceOptions) {
    this.db = options.db;
    this.eventBus = options.eventBus;
  }

  /**
   * Initialize alert service and load configurations
   */
  async initialize() {
    await this.loadAlertConfigs();
    logInfo('Alert service initialized');
  }

  /**
   * Load all enabled alert configurations from database
   */
  private async loadAlertConfigs() {
    try {
      const configs = await this.db.query.alertConfigs.findMany({
        where: eq(alertConfigs.enabled, true),
      });

      // Group configs by entity+field for efficient lookup
      this.alertConfigsCache.clear();
      for (const config of configs) {
        const key = `${config.entityId}:${config.field}`;
        const existing = this.alertConfigsCache.get(key) || [];
        existing.push(config as AlertConfigData);
        this.alertConfigsCache.set(key, existing);
      }

      this.cacheTimestamp = Date.now();
      logInfo(`Loaded ${configs.length} active alert configurations`);
    } catch (err) {
      logErr('Failed to load alert configurations:', err);
    }
  }

  /**
   * Refresh alert configs if cache is stale
   */
  private async refreshCacheIfNeeded() {
    if (Date.now() - this.cacheTimestamp > this.CACHE_TTL) {
      await this.loadAlertConfigs();
    }
  }

  /**
   * Evaluate alerts for a telemetry value
   */
  async evaluateAlerts(
    entityId: string,
    field: string,
    value: number,
    timestamp: Date,
  ) {
    await this.refreshCacheIfNeeded();

    const key = `${entityId}:${field}`;
    const configs = this.alertConfigsCache.get(key);

    if (!configs || configs.length === 0) {
      return;
    }

    for (const config of configs) {
      try {
        await this.evaluateAlert(config, value, timestamp);
      } catch (err) {
        logErr(`Failed to evaluate alert ${config.id}:`, err);
      }
    }
  }

  /**
   * Evaluate a single alert configuration
   */
  private async evaluateAlert(
    config: AlertConfigData,
    value: number,
    timestamp: Date,
  ) {
    let shouldTrigger = false;
    let threshold: number | undefined;

    switch (config.alertType) {
      case 'threshold':
        ({ shouldTrigger, threshold } = this.checkThreshold(config, value));
        break;
      case 'range':
        ({ shouldTrigger, threshold } = this.checkRange(config, value));
        break;
      case 'rate_of_change':
        ({ shouldTrigger, threshold } = await this.checkRateOfChange(
          config,
          value,
          timestamp,
        ));
        break;
    }

    const alertKey = `${config.id}:${config.entityId}:${config.field}`;
    const existingAlert = this.activeAlerts.get(alertKey);

    if (shouldTrigger && !existingAlert) {
      // Trigger new alert
      await this.triggerAlert(config, value, threshold, timestamp);
    } else if (!shouldTrigger && existingAlert) {
      // Resolve existing alert
      await this.resolveAlert(existingAlert, timestamp);
    }
  }

  /**
   * Check threshold condition
   */
  private checkThreshold(
    config: AlertConfigData,
    value: number,
  ): { shouldTrigger: boolean; threshold?: number } {
    if (
      config.thresholdValue === null ||
      config.thresholdValue === undefined ||
      !config.thresholdOperator
    ) {
      return { shouldTrigger: false };
    }

    const threshold = config.thresholdValue;
    let shouldTrigger = false;

    switch (config.thresholdOperator) {
      case 'gt':
        shouldTrigger = value > threshold;
        break;
      case 'gte':
        shouldTrigger = value >= threshold;
        break;
      case 'lt':
        shouldTrigger = value < threshold;
        break;
      case 'lte':
        shouldTrigger = value <= threshold;
        break;
    }

    return { shouldTrigger, threshold };
  }

  /**
   * Check range condition
   */
  private checkRange(
    config: AlertConfigData,
    value: number,
  ): { shouldTrigger: boolean; threshold?: number } {
    if (
      config.rangeMin === null ||
      config.rangeMin === undefined ||
      config.rangeMax === null ||
      config.rangeMax === undefined
    ) {
      return { shouldTrigger: false };
    }

    const shouldTrigger = value < config.rangeMin || value > config.rangeMax;
    const threshold =
      value < config.rangeMin ? config.rangeMin : config.rangeMax;

    return { shouldTrigger, threshold };
  }

  /**
   * Check rate of change condition
   */
  private async checkRateOfChange(
    config: AlertConfigData,
    value: number,
    timestamp: Date,
  ): Promise<{ shouldTrigger: boolean; threshold?: number }> {
    if (
      config.rateWindow === null ||
      config.rateWindow === undefined ||
      config.rateThreshold === null ||
      config.rateThreshold === undefined
    ) {
      return { shouldTrigger: false };
    }

    const key = `${config.id}:${config.entityId}:${config.field}`;
    const tracking = this.rateOfChangeData.get(key) || {
      lastEvaluation: 0,
      values: [],
    };

    const now = timestamp.getTime();
    const windowStart = now - config.rateWindow;

    // Add current value
    tracking.values.push({ timestamp: now, value });

    // Remove values outside the window
    tracking.values = tracking.values.filter((v) => v.timestamp >= windowStart);

    // Need at least 2 values to calculate rate
    if (tracking.values.length < 2) {
      this.rateOfChangeData.set(key, tracking);
      return { shouldTrigger: false };
    }

    // Calculate rate of change
    const oldest = tracking.values[0];
    const newest = tracking.values.at(-1);

    if (!oldest || !newest) {
      return { shouldTrigger: false };
    }

    const timeDiff = newest.timestamp - oldest.timestamp;
    const valueDiff = newest.value - oldest.value;

    // Rate per millisecond
    const rate = timeDiff > 0 ? Math.abs(valueDiff / timeDiff) : 0;

    // Convert threshold to rate per millisecond (assuming threshold is per second)
    const thresholdRate = config.rateThreshold / 1000;

    this.rateOfChangeData.set(key, tracking);

    return {
      shouldTrigger: rate > thresholdRate,
      threshold: config.rateThreshold,
    };
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(
    config: AlertConfigData,
    value: number,
    threshold: number | undefined,
    timestamp: Date,
  ) {
    const historyId = createId({ prefix: 'alert_event' });
    const message = this.generateAlertMessage(config, value, threshold);

    try {
      // Record in alert history
      await this.db.insert(alertHistory).values({
        acknowledged: false,
        alertConfigId: config.id,
        entityId: config.entityId,
        homeId: config.homeId,
        id: historyId,
        message,
        resolvedAt: null,
        severity: config.severity,
        threshold: threshold ?? null,
        triggeredAt: timestamp,
        value,
      });

      // Track active alert
      const alertKey = `${config.id}:${config.entityId}:${config.field}`;
      this.activeAlerts.set(alertKey, {
        configId: config.id,
        entityId: config.entityId,
        field: config.field,
        historyId,
        triggeredAt: timestamp,
      });

      // Publish event
      const event: AlertEvent = {
        alertId: historyId,
        configId: config.id,
        entityId: config.entityId,
        message,
        severity: config.severity,
        threshold,
        triggeredAt: timestamp,
        value,
      };

      this.eventBus.publishAlertTriggered(event);

      logInfo(
        `Alert triggered: ${config.name} (${config.severity}) - ${message}`,
      );
    } catch (err) {
      logErr('Failed to trigger alert:', err);
    }
  }

  /**
   * Resolve an alert
   */
  private async resolveAlert(alert: ActiveAlert, timestamp: Date) {
    try {
      // Update alert history
      await this.db
        .update(alertHistory)
        .set({ resolvedAt: timestamp })
        .where(eq(alertHistory.id, alert.historyId));

      // Remove from active alerts
      const alertKey = `${alert.configId}:${alert.entityId}:${alert.field}`;
      this.activeAlerts.delete(alertKey);

      // Get alert details for event
      const alertRecord = await this.db.query.alertHistory.findFirst({
        where: eq(alertHistory.id, alert.historyId),
      });

      if (alertRecord) {
        // Publish event
        const event: AlertEvent = {
          alertId: alert.historyId,
          configId: alert.configId,
          entityId: alert.entityId,
          message: `${alertRecord.message} (Resolved)`,
          severity: alertRecord.severity as 'info' | 'warning' | 'critical',
          threshold: alertRecord.threshold ?? undefined,
          triggeredAt: alertRecord.triggeredAt,
          value: alertRecord.value,
        };

        this.eventBus.publishAlertResolved(event);
      }

      logInfo(`Alert resolved: ${alert.historyId}`);
    } catch (err) {
      logErr('Failed to resolve alert:', err);
    }
  }

  /**
   * Generate alert message based on config and values
   */
  private generateAlertMessage(
    config: AlertConfigData,
    value: number,
    threshold?: number,
  ): string {
    switch (config.alertType) {
      case 'threshold':
        if (threshold !== undefined && config.thresholdOperator) {
          const operator = this.formatOperator(config.thresholdOperator);
          return `${config.field} is ${value} (${operator} ${threshold})`;
        }
        return `${config.field} threshold exceeded: ${value}`;

      case 'range':
        if (config.rangeMin !== null && config.rangeMax !== null) {
          return `${config.field} is ${value} (outside range ${config.rangeMin}-${config.rangeMax})`;
        }
        return `${config.field} outside range: ${value}`;

      case 'rate_of_change':
        if (threshold !== undefined) {
          return `${config.field} changing rapidly: ${value} (rate threshold: ${threshold})`;
        }
        return `${config.field} rate of change exceeded: ${value}`;

      default:
        return `Alert: ${config.field} = ${value}`;
    }
  }

  /**
   * Format operator for display
   */
  private formatOperator(operator: string): string {
    switch (operator) {
      case 'gt':
        return '>';
      case 'gte':
        return '≥';
      case 'lt':
        return '<';
      case 'lte':
        return '≤';
      default:
        return operator;
    }
  }

  /**
   * Get all alert configurations for an entity
   */
  async getAlertConfigs(entityId: string, field?: string) {
    try {
      const conditions = [eq(alertConfigs.entityId, entityId)];
      if (field) {
        conditions.push(eq(alertConfigs.field, field));
      }

      const where = conditions.length > 1 ? and(...conditions) : conditions[0];

      return await this.db.query.alertConfigs.findMany({
        where,
      });
    } catch (err) {
      logErr('Failed to get alert configs:', err);
      return [];
    }
  }

  /**
   * Get alert history for an entity
   */
  async getAlertHistory(
    entityId: string,
    options: {
      limit?: number;
      unacknowledged?: boolean;
      unresolved?: boolean;
    } = {},
  ) {
    try {
      const conditions = [eq(alertHistory.entityId, entityId)];

      if (options.unacknowledged) {
        conditions.push(eq(alertHistory.acknowledged, false));
      }

      if (options.unresolved) {
        conditions.push(isNull(alertHistory.resolvedAt));
      }

      const where = conditions.length > 1 ? and(...conditions) : conditions[0];

      return await this.db.query.alertHistory.findMany({
        limit: options.limit || 100,
        orderBy: [desc(alertHistory.triggeredAt)],
        where,
      });
    } catch (err) {
      logErr('Failed to get alert history:', err);
      return [];
    }
  }

  /**
   * Get active (unresolved) alerts
   */
  async getActiveAlerts(homeId?: string) {
    try {
      const conditions = [isNull(alertHistory.resolvedAt)];
      if (homeId) {
        conditions.push(eq(alertHistory.homeId, homeId));
      }

      const where = conditions.length > 1 ? and(...conditions) : conditions[0];

      return await this.db.query.alertHistory.findMany({
        orderBy: [desc(alertHistory.triggeredAt)],
        where,
      });
    } catch (err) {
      logErr('Failed to get active alerts:', err);
      return [];
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string) {
    try {
      await this.db
        .update(alertHistory)
        .set({ acknowledged: true })
        .where(eq(alertHistory.id, alertId));

      logDebug(`Alert acknowledged: ${alertId}`);
    } catch (err) {
      logErr('Failed to acknowledge alert:', err);
      throw err;
    }
  }

  /**
   * Force cache refresh
   */
  async refreshConfigs() {
    await this.loadAlertConfigs();
  }

  /**
   * Create a new alert configuration
   */
  async createAlertConfig(config: {
    entityId: string;
    homeId: string;
    name: string;
    alertType: 'threshold' | 'range' | 'rate_of_change';
    field: string;
    severity: 'info' | 'warning' | 'critical';
    enabled: boolean;
    showInGraph: boolean;
    thresholdValue?: number | null;
    thresholdOperator?: string | null;
    rangeMin?: number | null;
    rangeMax?: number | null;
    rateWindow?: number | null;
    rateThreshold?: number | null;
  }) {
    try {
      const id = createId({ prefix: 'alert_cfg' });

      const [newConfig] = await this.db
        .insert(alertConfigs)
        .values({
          alertType: config.alertType,
          enabled: config.enabled,
          entityId: config.entityId,
          field: config.field,
          homeId: config.homeId,
          id,
          name: config.name,
          rangeMax: config.rangeMax ?? null,
          rangeMin: config.rangeMin ?? null,
          rateThreshold: config.rateThreshold ?? null,
          rateWindow: config.rateWindow ?? null,
          severity: config.severity,
          showInGraph: config.showInGraph,
          thresholdOperator: config.thresholdOperator ?? null,
          thresholdValue: config.thresholdValue ?? null,
        })
        .returning();

      // Refresh cache to pick up new config
      await this.loadAlertConfigs();

      logInfo(`Alert config created: ${id}`);
      return newConfig;
    } catch (err) {
      logErr('Failed to create alert config:', err);
      throw err;
    }
  }

  /**
   * Update an alert configuration
   */
  async updateAlertConfig(
    id: string,
    updates: {
      name?: string;
      alertType?: 'threshold' | 'range' | 'rate_of_change';
      field?: string;
      severity?: 'info' | 'warning' | 'critical';
      enabled?: boolean;
      showInGraph?: boolean;
      thresholdValue?: number | null;
      thresholdOperator?: string | null;
      rangeMin?: number | null;
      rangeMax?: number | null;
      rateWindow?: number | null;
      rateThreshold?: number | null;
    },
  ) {
    try {
      await this.db
        .update(alertConfigs)
        .set(updates)
        .where(eq(alertConfigs.id, id));

      // Refresh cache to pick up changes
      await this.loadAlertConfigs();

      logInfo(`Alert config updated: ${id}`);
    } catch (err) {
      logErr('Failed to update alert config:', err);
      throw err;
    }
  }

  /**
   * Delete an alert configuration
   */
  async deleteAlertConfig(id: string) {
    try {
      await this.db.delete(alertConfigs).where(eq(alertConfigs.id, id));

      // Refresh cache to remove deleted config
      await this.loadAlertConfigs();

      logInfo(`Alert config deleted: ${id}`);
    } catch (err) {
      logErr('Failed to delete alert config:', err);
      throw err;
    }
  }
}

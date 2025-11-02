/**
 * Alert System Types
 * Shared types for alert configuration and history
 */

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'threshold' | 'range' | 'rate_of_change';
export type ThresholdOperator = 'gt' | 'lt' | 'gte' | 'lte';

export interface AlertConfig {
  id: string;
  entityId: string;
  homeId: string;
  name: string;
  enabled: boolean;
  severity: AlertSeverity;
  alertType: AlertType;
  field: string;

  // Threshold config
  thresholdValue?: number;
  thresholdOperator?: ThresholdOperator;

  // Range config
  rangeMin?: number;
  rangeMax?: number;

  // Rate of change config
  rateWindow?: number;
  rateThreshold?: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface AlertHistoryEvent {
  id: string;
  alertConfigId: string;
  entityId: string;
  homeId: string;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold?: number;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledged: boolean;
}

export interface AlertNotification {
  alertId: string;
  configId: string;
  entityId: string;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold?: number;
  triggeredAt: Date;
  type: 'triggered' | 'resolved';
}

/**
 * Helper to get severity color for UI
 */
export function getAlertSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'info':
      return 'hsl(var(--chart-3))'; // Blue
    case 'warning':
      return 'hsl(var(--chart-5))'; // Orange/Yellow
    case 'critical':
      return 'hsl(var(--destructive))'; // Red
    default:
      return 'hsl(var(--muted))';
  }
}

/**
 * Helper to get severity label for UI
 */
export function getAlertSeverityLabel(severity: AlertSeverity): string {
  switch (severity) {
    case 'info':
      return 'Info';
    case 'warning':
      return 'Warning';
    case 'critical':
      return 'Critical';
    default:
      return 'Unknown';
  }
}

/**
 * Helper to get alert type label for UI
 */
export function getAlertTypeLabel(type: AlertType): string {
  switch (type) {
    case 'threshold':
      return 'Threshold';
    case 'range':
      return 'Range';
    case 'rate_of_change':
      return 'Rate of Change';
    default:
      return 'Unknown';
  }
}

/**
 * Helper to format threshold operator for display
 */
export function formatThresholdOperator(operator: ThresholdOperator): string {
  switch (operator) {
    case 'gt':
      return '>';
    case 'lt':
      return '<';
    case 'gte':
      return '≥';
    case 'lte':
      return '≤';
    default:
      return '';
  }
}


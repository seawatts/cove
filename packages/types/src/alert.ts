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
  showInGraph: boolean;

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
 * Helper to get severity color for UI (CSS variable format)
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
 * Helper to get resolved severity color value for chart libraries
 * This resolves CSS variables to actual color values that libraries like Recharts can render
 * by creating a temporary element and reading its computed color
 */
export function getAlertSeverityColorValue(severity: AlertSeverity): string {
  // Only resolve in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Fallback colors for SSR/Node
    switch (severity) {
      case 'info':
        return 'rgb(59, 130, 246)'; // Blue
      case 'warning':
        return 'rgb(245, 158, 11)'; // Orange
      case 'critical':
        return 'rgb(239, 68, 68)'; // Red
      default:
        return 'rgb(107, 114, 128)'; // Gray
    }
  }

  // Create a temporary element to force color computation
  const tempEl = document.createElement('div');
  tempEl.style.position = 'absolute';
  tempEl.style.visibility = 'hidden';
  tempEl.style.pointerEvents = 'none';

  // Map severity to CSS variable
  let colorVar: string;
  switch (severity) {
    case 'info':
      colorVar = 'var(--chart-3)';
      break;
    case 'warning':
      colorVar = 'var(--chart-5)';
      break;
    case 'critical':
      colorVar = 'var(--destructive)';
      break;
    default:
      colorVar = 'var(--muted)';
  }

  tempEl.style.color = colorVar;
  document.body.appendChild(tempEl);

  // Get the computed color (browser converts to rgb/rgba)
  const computedColor = getComputedStyle(tempEl).color;

  // Clean up
  document.body.removeChild(tempEl);

  // Return computed color or fallback
  if (
    computedColor &&
    computedColor !== 'rgba(0, 0, 0, 0)' &&
    computedColor !== 'transparent'
  ) {
    return computedColor;
  }

  // Fallback colors
  switch (severity) {
    case 'info':
      return 'rgb(59, 130, 246)';
    case 'warning':
      return 'rgb(245, 158, 11)';
    case 'critical':
      return 'rgb(239, 68, 68)';
    default:
      return 'rgb(107, 114, 128)';
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

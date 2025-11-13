/**
 * Alert System Types
 * Shared types for alert configuration and history
 */

export type AlertSeverity =
  | 'level1'
  | 'level2'
  | 'level3'
  | 'level4'
  | 'level5';
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
  severity: AlertSeverity | string;
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
 * Uses oklch colors defined in globals.css with light/dark mode support
 */
export function getAlertSeverityColor(
  severity: AlertSeverity | string,
): string {
  switch (severity) {
    case 'level1':
      return 'var(--severity-1)'; // Dark Green (Excellent)
    case 'level2':
      return 'var(--severity-2)'; // Teal (Good)
    case 'level3':
      return 'var(--severity-3)'; // Blue (Normal)
    case 'level4':
      return 'var(--severity-4)'; // Orange (Warning)
    case 'level5':
      return 'var(--severity-5)'; // Red (Critical)
    default:
      return 'var(--muted)'; // Gray
  }
}

/**
 * Helper to get resolved severity color value for chart libraries
 * Resolves CSS variables to actual color values that libraries like Recharts can render
 * by creating a temporary element and reading its computed color
 */
export function getAlertSeverityColorValue(
  severity: AlertSeverity | string,
): string {
  // Only resolve in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Fallback colors for SSR/Node (approximate oklch values as rgb)
    switch (severity) {
      case 'level1':
        return 'rgb(22, 163, 74)'; // Green (Excellent)
      case 'level2':
        return 'rgb(20, 184, 166)'; // Teal (Good)
      case 'level3':
        return 'rgb(59, 130, 246)'; // Blue (Normal)
      case 'level4':
        return 'rgb(251, 146, 60)'; // Orange (Warning)
      case 'level5':
        return 'rgb(239, 68, 68)'; // Red (Critical)
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
    case 'level1':
      colorVar = 'var(--severity-1)';
      break;
    case 'level2':
      colorVar = 'var(--severity-2)';
      break;
    case 'level3':
      colorVar = 'var(--severity-3)';
      break;
    case 'level4':
      colorVar = 'var(--severity-4)';
      break;
    case 'level5':
      colorVar = 'var(--severity-5)';
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

  // Fallback colors if computation fails
  switch (severity) {
    case 'level1':
      return 'rgb(22, 163, 74)';
    case 'level2':
      return 'rgb(20, 184, 166)';
    case 'level3':
      return 'rgb(59, 130, 246)';
    case 'level4':
      return 'rgb(251, 146, 60)';
    case 'level5':
      return 'rgb(239, 68, 68)';
    default:
      return 'rgb(107, 114, 128)';
  }
}

/**
 * Helper to get severity label for UI
 */
export function getAlertSeverityLabel(
  severity: AlertSeverity | string,
): string {
  switch (severity) {
    case 'level1':
      return 'Level 1 - Excellent';
    case 'level2':
      return 'Level 2 - Good';
    case 'level3':
      return 'Level 3 - Normal';
    case 'level4':
      return 'Level 4 - Warning';
    case 'level5':
      return 'Level 5 - Critical';
    default:
      return 'Unknown';
  }
}

/**
 * Helper to get severity level number
 */
export function getAlertSeverityLevel(severity: AlertSeverity): number {
  switch (severity) {
    case 'level1':
      return 1;
    case 'level2':
      return 2;
    case 'level3':
      return 3;
    case 'level4':
      return 4;
    case 'level5':
      return 5;
    default:
      return 0;
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

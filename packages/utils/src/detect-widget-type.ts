/**
 * Widget type detection logic for automatic widget selection
 * Based on sensor characteristics and data patterns
 */

import { WidgetType } from '@cove/types/widget';

export function detectWidgetType(sensorType: string): WidgetType {
  // Default to Chart for all sensors (unless specific exceptions below)

  // Binary sensors -> Value Card (no meaningful chart data)
  if (sensorType === 'binary') return WidgetType.ValueCard;

  // Event-based sensors -> Table (show recent events)
  if (sensorType === 'event') return WidgetType.Table;

  // Default to Chart for all other sensor types
  return WidgetType.Chart;
}

/**
 * Get available widget types for a sensor (for dropdown selection)
 */
export function getAvailableWidgetTypes(
  sensorKey: string,
  sensorType: string,
): WidgetType[] {
  const available: WidgetType[] = [WidgetType.ValueCard]; // Always available

  // Always add Chart for continuous sensors (default widget type)
  if (sensorType === 'continuous') {
    available.push(WidgetType.Chart);
  }

  // Add Radial for percentage-based sensors
  if (sensorKey.includes('humidity') || sensorKey.includes('battery')) {
    available.push(WidgetType.Radial);
  }

  // Add Gauge for sensors with defined ranges
  if (
    sensorKey.includes('rssi') ||
    sensorKey.includes('signal') ||
    sensorKey.includes('temperature') ||
    sensorKey.includes('pressure')
  ) {
    available.push(WidgetType.Gauge);
  }

  // Add Table only for event-based sensors
  if (sensorType === 'event') {
    available.push(WidgetType.Table);
  }

  // Remove duplicates
  return [...new Set(available)];
}

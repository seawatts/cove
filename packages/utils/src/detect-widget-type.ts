/**
 * Widget type detection logic for automatic widget selection
 * Based on sensor characteristics and data patterns
 */

import { WidgetType } from '@cove/types/widget';

export function detectWidgetType(
  sensorKey: string,
  sensorType: string,
  hasHistoricalData: boolean,
): WidgetType {
  // Binary sensors -> Value Card
  if (sensorType === 'binary') return WidgetType.ValueCard;

  // Percentage values (0-100) -> Radial/Gauge
  if (sensorKey.includes('humidity') || sensorKey.includes('battery')) {
    return WidgetType.Radial;
  }

  // WiFi signal strength (negative dBm values) -> Gauge
  if (sensorKey.includes('rssi') || sensorKey.includes('signal')) {
    return WidgetType.Gauge;
  }

  // Continuous sensors with history -> Chart
  if (sensorType === 'continuous' && hasHistoricalData) {
    return WidgetType.Chart;
  }

  // Slow changing sensors -> Value Card
  if (sensorType === 'slow_changing') return WidgetType.ValueCard;

  // Event-based sensors -> Table (show recent events)
  if (sensorType === 'event') return WidgetType.Table;

  // Default to Chart for continuous sensors, Value Card for others
  return sensorType === 'continuous' ? WidgetType.Chart : WidgetType.ValueCard;
}

/**
 * Get available widget types for a sensor (for dropdown selection)
 */
export function getAvailableWidgetTypes(
  sensorKey: string,
  sensorType: string,
  hasHistoricalData: boolean,
): WidgetType[] {
  const available: WidgetType[] = [WidgetType.ValueCard]; // Always available

  // Add Chart if we have historical data or it's a continuous sensor
  if (hasHistoricalData || sensorType === 'continuous') {
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

  // Add Table for event-based or if we have historical data
  if (sensorType === 'event' || hasHistoricalData) {
    available.push(WidgetType.Table);
  }

  // Remove duplicates
  return [...new Set(available)];
}

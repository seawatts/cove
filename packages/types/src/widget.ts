/**
 * Widget types and interfaces for the Cove device detail page
 * Supports multiple visualization types for sensor data
 */

export enum WidgetType {
  Chart = 'chart',
  ValueCard = 'value_card',
  Gauge = 'gauge',
  Table = 'table',
  Radial = 'radial',
}

export interface WidgetConfig {
  chartType?: 'area' | 'line' | 'bar'; // For Chart widget
  showTrend?: boolean;
  colorScheme?: string;
  minValue?: number;
  maxValue?: number;
  thresholds?: { value: number; color: string; label?: string }[];
}

export interface SensorMetadata {
  key: string;
  name: string;
  unit?: string;
  type: 'continuous' | 'binary' | 'slow_changing' | 'event';
  currentValue?: unknown;
  lastChanged?: Date;
}

export interface WidgetPreference {
  id: string;
  userId: string;
  deviceId: string;
  sensorKey: string;
  widgetType: WidgetType;
  widgetConfig: WidgetConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetProps {
  deviceId: string;
  sensor: SensorMetadata;
  config: WidgetConfig;
}

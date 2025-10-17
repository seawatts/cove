/**
 * Entity types for Home Assistant-inspired architecture
 * These types are used by protocol adapters and are not in the database schema
 */

// Entity kinds enum for type safety
export enum EntityKind {
  Light = 'light',
  Switch = 'switch',
  Sensor = 'sensor',
  BinarySensor = 'binary_sensor',
  Lock = 'lock',
  Camera = 'camera',
  Speaker = 'speaker',
  Fan = 'fan',
  Outlet = 'outlet',
  Thermostat = 'thermostat',
  Cover = 'cover',
  Climate = 'climate',
  Number = 'number',
  Select = 'select',
  Button = 'button',
  Text = 'text',
  Time = 'time',
  Date = 'date',
  DateTime = 'datetime',
  Color = 'color',
  Other = 'other',
}

// Common entity traits/capabilities
export interface EntityTraits {
  // Common capabilities
  unit_of_measurement?: string; // '°C', 'ppm', '%', etc.
  device_class?: string; // 'temperature', 'humidity', 'motion', etc.
  icon?: string; // Material Design icon name

  // Light-specific
  supports_brightness?: boolean;
  supports_color_temp?: boolean;
  supports_rgb?: boolean;
  supports_rgbw?: boolean;
  supports_rgbww?: boolean;
  min_color_temp?: number;
  max_color_temp?: number;

  // Sensor-specific
  min_value?: number;
  max_value?: number;
  step?: number;
  precision?: number;

  // Switch-specific
  supports_on_off?: boolean;

  // Lock-specific
  supports_lock?: boolean;
  supports_unlock?: boolean;

  // Cover-specific
  supports_open?: boolean;
  supports_close?: boolean;
  supports_stop?: boolean;
  supports_position?: boolean;

  // Climate-specific
  supports_target_temperature?: boolean;
  supports_target_temperature_range?: boolean;
  supports_hvac_mode?: boolean;
  supports_fan_mode?: boolean;
  supports_preset_mode?: boolean;

  // Custom traits
  [key: string]: unknown;
}

// State update interface for StateManager
export interface StateUpdate {
  entityId: string; // Changed from deviceId + stateKey
  state: string; // Can be numeric string or text
  attrs?: Record<string, unknown>; // metadata (unit, source, etc.)
  timestamp?: Date;
}

// Legacy metric interface - will be removed after migration
export interface DeviceMetric {
  id: string;
  deviceId: string;
  metricType: string;
  value: number;
  unit?: string;
  timestamp: Date;
}

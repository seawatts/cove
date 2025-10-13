/**
 * Device types and capabilities for Cove home automation platform
 * Ported from .old/crates/db/src/models/device.rs and .old/crates/types/src/devices.rs
 */

export enum DeviceType {
  Light = 'light',
  Switch = 'switch',
  Sensor = 'sensor',
  Thermostat = 'thermostat',
  Lock = 'lock',
  Camera = 'camera',
  Speaker = 'speaker',
  Fan = 'fan',
  Outlet = 'outlet',
  Other = 'other',
}

export enum DeviceCapability {
  // Power & Switching
  OnOff = 'on_off',

  // Lighting
  Brightness = 'brightness',
  ColorTemperature = 'color_temperature',
  ColorRgb = 'color_rgb',

  // Environmental Sensors
  Temperature = 'temperature',
  Humidity = 'humidity',
  AirQuality = 'air_quality',
  Co2 = 'co2',
  Pressure = 'pressure',

  // Motion & Occupancy
  Motion = 'motion',
  Occupancy = 'occupancy',
  ContactSensor = 'contact_sensor',

  // Power Management
  Battery = 'battery',
  PowerConsumption = 'power_consumption',
  Voltage = 'voltage',

  // Security
  Lock = 'lock',
  Unlock = 'unlock',

  // Media
  AudioVolume = 'audio_volume',
  AudioPlayback = 'audio_playback',
  VideoStream = 'video_stream',

  // Climate Control
  FanSpeed = 'fan_speed',
  Heating = 'heating',
  Cooling = 'cooling',
  TargetTemperature = 'target_temperature',

  // Custom
  Custom = 'custom',
}

export enum ProtocolType {
  ESPHome = 'esphome',
  Hue = 'hue',
  Matter = 'matter',
  Zigbee = 'zigbee',
  ZWave = 'zwave',
  WiFi = 'wifi',
  Bluetooth = 'bluetooth',
  MQTT = 'mqtt',
  HTTP = 'http',
}

export interface DeviceState {
  [key: string]: unknown;
  // Common state properties
  online?: boolean;
  available?: boolean;
  // Power
  on?: boolean;
  // Lighting
  brightness?: number; // 0-100
  color_temp?: number; // Kelvin
  rgb?: [number, number, number]; // RGB values
  // Sensors
  temperature?: number; // Celsius
  humidity?: number; // Percentage
  co2?: number; // PPM
  battery?: number; // Percentage
  // Media
  volume?: number; // 0-100
  // Climate
  target_temperature?: number; // Celsius
  fan_speed?: number; // 0-100
}

export interface DeviceConfig {
  [key: string]: unknown;
  // Protocol-specific configuration
  ip_address?: string;
  mac_address?: string;
  api_key?: string;
  update_interval?: number; // Seconds
  // Display settings
  icon?: string;
  color?: string;
}

export interface Device {
  id: string;
  name: string;
  deviceType: DeviceType;
  roomId?: string;
  hubId?: string;

  capabilities: DeviceCapability[];
  protocol?: ProtocolType;

  ipAddress?: string;
  macAddress?: string;

  state: DeviceState;
  config: DeviceConfig;

  online: boolean;
  available: boolean;

  createdAt: Date;
  updatedAt: Date;
  lastSeen?: Date;

  // User/org ownership
  userId: string;
  orgId?: string;
}

export interface DeviceMetric {
  id: string;
  deviceId: string;
  metricType: string;
  value: number;
  unit?: string;
  timestamp: Date;
}

export interface DeviceCommand {
  deviceId: string;
  capability: DeviceCapability;
  value: unknown;
  timestamp?: Date;
}

export interface DeviceDiscovery {
  protocol: ProtocolType;
  name: string;
  deviceType?: DeviceType;
  ipAddress?: string;
  macAddress?: string;
  metadata: Record<string, unknown>;
  discovered_at: Date;
}

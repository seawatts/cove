/**
 * ESPHome Native API Types
 * Based on https://github.com/hjdhjd/esphome-client
 */

// Message type IDs from ESPHome protocol
// Reference: packages/hub/src/protocols/esphome/proto/api.proto
export enum MessageType {
  HelloRequest = 1,
  HelloResponse = 2,
  ConnectRequest = 3,
  ConnectResponse = 4,
  DisconnectRequest = 5,
  DisconnectResponse = 6,
  PingRequest = 7,
  PingResponse = 8,
  DeviceInfoRequest = 9,
  DeviceInfoResponse = 10,
  ListEntitiesRequest = 11,
  // Entity responses
  ListEntitiesBinarySensorResponse = 12,
  ListEntitiesCoverResponse = 13,
  ListEntitiesFanResponse = 14,
  ListEntitiesLightResponse = 15,
  ListEntitiesSensorResponse = 16,
  ListEntitiesSwitchResponse = 17,
  ListEntitiesTextSensorResponse = 18,
  ListEntitiesDoneResponse = 19,
  // State subscriptions
  SubscribeStatesRequest = 20,
  BinarySensorStateResponse = 21,
  CoverStateResponse = 22,
  FanStateResponse = 23,
  LightStateResponse = 24,
  SensorStateResponse = 25,
  SwitchStateResponse = 26,
  TextSensorStateResponse = 27,
  // Commands
  SubscribeLogsRequest = 28,
  SubscribeLogsResponse = 29,
  CoverCommandRequest = 30,
  FanCommandRequest = 31,
  LightCommandRequest = 32,
  SwitchCommandRequest = 33,
  // More entity types
  ListEntitiesServicesResponse = 41,
  ExecuteServiceRequest = 42,
  // Button
  ListEntitiesButtonResponse = 61,
  ButtonCommandRequest = 62,
  // Number
  ListEntitiesNumberResponse = 46,
  NumberCommandRequest = 47,
  NumberStateResponse = 48,
  // Select
  ListEntitiesSelectResponse = 50,
  SelectCommandRequest = 51,
  SelectStateResponse = 52,
  // Climate
  ListEntitiesClimateResponse = 35,
  ClimateStateResponse = 36,
  ClimateCommandRequest = 37,
}

// Device Info
export interface DeviceInfo {
  usesPassword: boolean;
  name: string;
  macAddress: string;
  esphomeVersion: string;
  compilationTime: string;
  model: string;
  hasDeepSleep: boolean;
  projectName: string;
  projectVersion: string;
  webserverPort: number;
}

// Entity base
export interface Entity {
  objectId: string;
  key: number;
  name: string;
  uniqueId: string;
  icon?: string;
  disabled?: boolean;
}

// Sensor entity
export interface SensorEntity extends Entity {
  type: 'sensor';
  unitOfMeasurement?: string;
  accuracyDecimals?: number;
  deviceClass?: string;
  stateClass?: number;
}

// Sensor state
export interface SensorState {
  key: number;
  state: number;
  missingState: boolean;
}

// Binary Sensor entity
export interface BinarySensorEntity extends Entity {
  type: 'binary_sensor';
  deviceClass?: string;
}

// Binary Sensor state
export interface BinarySensorState {
  key: number;
  state: boolean;
  missingState: boolean;
}

// Switch entity
export interface SwitchEntity extends Entity {
  type: 'switch';
  deviceClass?: string;
  assumedState?: boolean;
}

// Switch state
export interface SwitchState {
  key: number;
  state: boolean;
}

// Light entity
export interface LightEntity extends Entity {
  type: 'light';
  supportsBrightness?: boolean;
  supportedColorModes?: number[];
  minMireds?: number;
  maxMireds?: number;
  effects?: string[];
}

// Light state
export interface LightState {
  key: number;
  state: boolean;
  brightness?: number;
  colorMode?: number;
  colorBrightness?: number;
  red?: number;
  green?: number;
  blue?: number;
  white?: number;
  colorTemperature?: number;
  effect?: string;
}

// Button entity
export interface ButtonEntity extends Entity {
  type: 'button';
  deviceClass?: string;
}

// Number entity
export interface NumberEntity extends Entity {
  type: 'number';
  minValue: number;
  maxValue: number;
  step: number;
  unitOfMeasurement?: string;
  deviceClass?: string;
  mode?: number;
}

// Number state
export interface NumberState {
  key: number;
  state: number;
  missingState: boolean;
}

// Text Sensor entity
export interface TextSensorEntity extends Entity {
  type: 'text_sensor';
  deviceClass?: string;
}

// Text Sensor state
export interface TextSensorState {
  key: number;
  state: string;
  missingState: boolean;
}

// Message frame
export interface MessageFrame {
  type: MessageType;
  data: Buffer;
}

// Command types
export interface SwitchCommand {
  key: number;
  state: boolean;
}

export interface LightCommand {
  key: number;
  state?: boolean;
  brightness?: number;
  colorMode?: number;
  red?: number;
  green?: number;
  blue?: number;
  white?: number;
  colorTemperature?: number;
  transitionLength?: number;
  flashLength?: number;
  effect?: string;
}

export interface ButtonCommand {
  key: number;
}

export interface NumberCommand {
  key: number;
  state: number;
}

// Union type of all entities
export type AnyEntity =
  | SensorEntity
  | BinarySensorEntity
  | SwitchEntity
  | LightEntity
  | ButtonEntity
  | NumberEntity
  | TextSensorEntity;

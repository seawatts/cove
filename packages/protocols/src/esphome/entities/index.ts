import type { ESPHomeConnection } from '../connection';
import { AlarmControlPanelEntity } from './alarm-control-panel';
import { BaseEntity, type EntityConfig, type EntityState } from './base';
import { BinarySensorEntity } from './binary-sensor';
import { ButtonEntity } from './button';
import { CameraEntity } from './camera';
import { ClimateEntity } from './climate';
import { CoverEntity } from './cover';
import { DateEntity } from './date';
import { DateTimeEntity } from './date-time';
import { EventEntity } from './event';
import { FanEntity } from './fan';
import { LightEntity } from './light';
import { LockEntity } from './lock';
import { MediaPlayerEntity } from './media-player';
import { NumberEntity } from './number';
import { SelectEntity } from './select';
import { SensorEntity } from './sensor';
import { SirenEntity } from './siren';
import { SwitchEntity } from './switch';
import { TextEntity } from './text';
import { TextSensorEntity } from './text-sensor';
import { TimeEntity } from './time';
import { UpdateEntity } from './update';
import { ValveEntity } from './valve';

export interface EntityClass {
  new (params: {
    connection?: ESPHomeConnection;
    config: EntityConfig; // Use base config type
    state?: EntityState; // Use base state type
  }): BaseEntity;
  getStateResponseName(): string;
  getListEntitiesResponseName(): string;
}

const entityClasses: Record<string, EntityClass> = {
  AlarmControlPanel: AlarmControlPanelEntity as unknown as EntityClass,
  BinarySensor: BinarySensorEntity as unknown as EntityClass,
  Button: ButtonEntity as unknown as EntityClass,
  Camera: CameraEntity as unknown as EntityClass,
  Climate: ClimateEntity as unknown as EntityClass,
  Cover: CoverEntity as unknown as EntityClass,
  Date: DateEntity as unknown as EntityClass,
  DateTime: DateTimeEntity as unknown as EntityClass,
  Event: EventEntity as unknown as EntityClass,
  Fan: FanEntity as unknown as EntityClass,
  Light: LightEntity as unknown as EntityClass,
  Lock: LockEntity as unknown as EntityClass,
  MediaPlayer: MediaPlayerEntity as unknown as EntityClass,
  Number: NumberEntity as unknown as EntityClass,
  Select: SelectEntity as unknown as EntityClass,
  Sensor: SensorEntity as unknown as EntityClass,
  Siren: SirenEntity as unknown as EntityClass,
  Switch: SwitchEntity as unknown as EntityClass,
  Text: TextEntity as unknown as EntityClass,
  TextSensor: TextSensorEntity as unknown as EntityClass,
  Time: TimeEntity as unknown as EntityClass,
  Update: UpdateEntity as unknown as EntityClass,
  Valve: ValveEntity as unknown as EntityClass,
};

export function createEntity(
  className: string,
  connection: ESPHomeConnection,
  config: unknown,
): BaseEntity {
  const EntityClass = entityClasses[className];
  if (!EntityClass) {
    throw new Error(`Entity ${className} not supported`);
  }
  return new EntityClass({ config: config as EntityConfig, connection });
}

export type {
  AlarmControlPanelConfig,
  AlarmControlPanelState,
} from './alarm-control-panel';
export type {
  EntityConfig,
  EntityState,
  TypedEntityConfig,
  TypedEntityState,
} from './base';
export type { BinarySensorConfig, BinarySensorState } from './binary-sensor';
export type { ButtonConfig, ButtonState } from './button';
export type { CameraConfig, CameraState } from './camera';
export type { ClimateConfig, ClimateState } from './climate';
export type { CoverConfig, CoverState } from './cover';
export type { DateConfig, DateState } from './date';
export type { DateTimeConfig, DateTimeState } from './date-time';
export type { EventConfig, EventState } from './event';
export type { FanConfig, FanState } from './fan';
export type { LightConfig, LightState } from './light';
export type { LockConfig, LockState } from './lock';
export type { MediaPlayerConfig, MediaPlayerState } from './media-player';
export type { NumberConfig, NumberState } from './number';
export type { SelectConfig, SelectState } from './select';
export type { SensorConfig, SensorState } from './sensor';
export type { SirenConfig, SirenState } from './siren';
export type { SwitchConfig, SwitchState } from './switch';
export type { TextConfig, TextState } from './text';
export type { TextSensorConfig, TextSensorState } from './text-sensor';
export type { TimeConfig, TimeState } from './time';
export type { UpdateConfig, UpdateState } from './update';
export type { ValveConfig, ValveState } from './valve';

export {
  AlarmControlPanelEntity,
  BaseEntity,
  BinarySensorEntity,
  ButtonEntity,
  CameraEntity,
  ClimateEntity,
  CoverEntity,
  DateEntity,
  DateTimeEntity,
  EventEntity,
  FanEntity,
  LightEntity,
  LockEntity,
  MediaPlayerEntity,
  NumberEntity,
  SelectEntity,
  SensorEntity,
  SirenEntity,
  SwitchEntity,
  TextEntity,
  TextSensorEntity,
  TimeEntity,
  UpdateEntity,
  ValveEntity,
  entityClasses as Entities,
};

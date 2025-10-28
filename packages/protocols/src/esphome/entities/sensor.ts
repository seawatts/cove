import type { ESPHomeConnection } from '../connection';
import type { SensorLastResetType, SensorStateClass } from '../protoc/api_pb';
import {
  ListEntitiesSensorResponseSchema,
  SensorStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface SensorConfig extends EntityConfig {
  icon: string;
  unitOfMeasurement: string;
  accuracyDecimals: number;
  forceUpdate: boolean;
  deviceClass: string;
  stateClass: SensorStateClass;
  legacyLastResetType: SensorLastResetType;
  disabledByDefault: boolean;
  entityCategory: number;
  deviceId: number;
}

export interface SensorState extends EntityState {
  state: number;
  missingState: boolean;
  deviceId: number;
}

export class SensorEntity extends BaseEntity<SensorConfig, SensorState> {
  public config: SensorConfig;
  public state?: SensorState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: SensorConfig;
    state?: SensorState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'SensorStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesSensorResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesSensorResponseSchema;
  }

  protected getStateSchema() {
    return SensorStateResponseSchema;
  }

  protected getCommandSchema() {
    // Sensors are read-only
    return null as unknown;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): SensorConfig {
    return protoMessage as SensorConfig;
  }

  public parseState(protoMessage: unknown): SensorState {
    return protoMessage as SensorState;
  }

  protected createCommand(): unknown {
    // Sensors are read-only
    return null;
  }

  // Sensors are read-only entities with no commands
}

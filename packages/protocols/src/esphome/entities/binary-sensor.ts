import type { ESPHomeConnection } from '../connection';
import {
  BinarySensorStateResponseSchema,
  ListEntitiesBinarySensorResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface BinarySensorConfig extends EntityConfig {
  deviceClass: string;
  isStatusBinarySensor: boolean;
  disabledByDefault: boolean;
  icon: string;
  entityCategory: number;
  deviceId: number;
}

export interface BinarySensorState extends EntityState {
  state: boolean;
  missingState: boolean;
  deviceId: number;
}

export class BinarySensorEntity extends BaseEntity<
  BinarySensorConfig,
  BinarySensorState
> {
  public config: BinarySensorConfig;
  public state?: BinarySensorState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: BinarySensorConfig;
    state?: BinarySensorState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'BinarySensorStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesBinarySensorResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesBinarySensorResponseSchema;
  }

  protected getStateSchema() {
    return BinarySensorStateResponseSchema;
  }

  protected getCommandSchema() {
    // Binary sensors are read-only
    return null as unknown;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): BinarySensorConfig {
    return protoMessage as BinarySensorConfig;
  }

  public parseState(protoMessage: unknown): BinarySensorState {
    return protoMessage as BinarySensorState;
  }

  protected createCommand(): unknown {
    // Binary sensors are read-only
    return null;
  }

  // Binary sensors are read-only entities with no commands
}

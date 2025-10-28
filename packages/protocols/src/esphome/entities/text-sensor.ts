import type { ESPHomeConnection } from '../connection';
import {
  ListEntitiesTextSensorResponseSchema,
  TextSensorStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface TextSensorConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
}

export interface TextSensorState extends EntityState {
  state: string;
  missingState: boolean;
}

export class TextSensorEntity extends BaseEntity<
  TextSensorConfig,
  TextSensorState
> {
  public config: TextSensorConfig;
  public state?: TextSensorState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: TextSensorConfig;
    state?: TextSensorState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'TextSensorStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesTextSensorResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesTextSensorResponseSchema;
  }

  protected getStateSchema() {
    return TextSensorStateResponseSchema;
  }

  protected getCommandSchema() {
    // TextSensor is read-only, no commands
    return null;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): TextSensorConfig {
    return protoMessage as TextSensorConfig;
  }

  public parseState(protoMessage: unknown): TextSensorState {
    return protoMessage as TextSensorState;
  }

  protected createCommand(): unknown {
    // TextSensor is read-only, no commands
    throw new Error('TextSensor does not support commands');
  }
}

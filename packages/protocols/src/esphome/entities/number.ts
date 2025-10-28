import type { ESPHomeConnection } from '../connection';
import type { NumberMode } from '../protoc/api_pb';
import {
  ListEntitiesNumberResponseSchema,
  NumberCommandRequestSchema,
  NumberStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface NumberConfig extends EntityConfig {
  icon: string;
  minValue: number;
  maxValue: number;
  step: number;
  disabledByDefault: boolean;
  entityCategory: number;
  unitOfMeasurement: string;
  mode: NumberMode;
  deviceClass: string;
  deviceId: number;
}

export interface NumberState extends EntityState {
  state: number;
  missingState: boolean;
  deviceId: number;
}

export interface NumberCommand {
  state: number;
}

export class NumberEntity extends BaseEntity<NumberConfig, NumberState> {
  public config: NumberConfig;
  public state?: NumberState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: NumberConfig;
    state?: NumberState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'NumberStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesNumberResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesNumberResponseSchema;
  }

  protected getStateSchema() {
    return NumberStateResponseSchema;
  }

  protected getCommandSchema() {
    return NumberCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): NumberConfig {
    return protoMessage as NumberConfig;
  }

  public parseState(protoMessage: unknown): NumberState {
    return protoMessage as NumberState;
  }

  protected createCommand(commandData: NumberCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setState(value: number): Promise<void> {
    if (value < this.config.minValue || value > this.config.maxValue) {
      throw new Error(
        `Value ${value} is outside range [${this.config.minValue}, ${this.config.maxValue}]`,
      );
    }
    await this.command({ state: value });
  }

  private async command(params: NumberCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's numberCommand method
    await this.connection.numberCommand(this.config.key, params.state);
  }
}

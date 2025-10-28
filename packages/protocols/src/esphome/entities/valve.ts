import type { ESPHomeConnection } from '../connection';
import {
  ListEntitiesValveResponseSchema,
  ValveCommandRequestSchema,
  ValveOperation,
  ValveStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface ValveConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
  assumedState: boolean;
}

export interface ValveState extends EntityState {
  state: ValveOperation;
  position: number;
}

export interface ValveCommand {
  operation: ValveOperation;
  position?: number;
}

export class ValveEntity extends BaseEntity<ValveConfig, ValveState> {
  public config: ValveConfig;
  public state?: ValveState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: ValveConfig;
    state?: ValveState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'ValveStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesValveResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesValveResponseSchema;
  }

  protected getStateSchema() {
    return ValveStateResponseSchema;
  }

  protected getCommandSchema() {
    return ValveCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): ValveConfig {
    return protoMessage as ValveConfig;
  }

  public parseState(protoMessage: unknown): ValveState {
    return protoMessage as ValveState;
  }

  protected createCommand(commandData: ValveCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setOperation(operation: ValveOperation): Promise<void> {
    await this.command({ operation });
  }

  async setPosition(position: number): Promise<void> {
    await this.command({
      operation: ValveOperation.IDLE, // Use IDLE as the operation for position setting
      position,
    });
  }

  private async command(params: ValveCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's valveCommand method
    await this.connection.valveCommand(
      this.config.key,
      params.operation,
      params.position,
    );
  }
}

import type { ESPHomeConnection } from '../connection';
import {
  ListEntitiesTimeResponseSchema,
  TimeCommandRequestSchema,
  TimeStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface TimeConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
}

export interface TimeState extends EntityState {
  state: string; // Time in HH:MM:SS format
}

export interface TimeCommand {
  state: string; // Time in HH:MM:SS format
}

export class TimeEntity extends BaseEntity<TimeConfig, TimeState> {
  public config: TimeConfig;
  public state?: TimeState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: TimeConfig;
    state?: TimeState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'TimeStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesTimeResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesTimeResponseSchema;
  }

  protected getStateSchema() {
    return TimeStateResponseSchema;
  }

  protected getCommandSchema() {
    return TimeCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): TimeConfig {
    return protoMessage as TimeConfig;
  }

  public parseState(protoMessage: unknown): TimeState {
    return protoMessage as TimeState;
  }

  protected createCommand(commandData: TimeCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setState(state: string): Promise<void> {
    // Validate time format (HH:MM:SS)
    const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
    if (!timeRegex.test(state)) {
      throw new Error(`Invalid time format: ${state}. Expected HH:MM:SS`);
    }
    await this.command({ state });
  }

  private async command(params: TimeCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's timeCommand method
    await this.connection.timeCommand(this.config.key, params.state);
  }
}

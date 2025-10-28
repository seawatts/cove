import type { ESPHomeConnection } from '../connection';
import {
  DateTimeCommandRequestSchema,
  DateTimeStateResponseSchema,
  ListEntitiesDateTimeResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface DateTimeConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
}

export interface DateTimeState extends EntityState {
  state: string; // DateTime in YYYY-MM-DDTHH:MM:SS format
}

export interface DateTimeCommand {
  state: string; // DateTime in YYYY-MM-DDTHH:MM:SS format
}

export class DateTimeEntity extends BaseEntity<DateTimeConfig, DateTimeState> {
  public config: DateTimeConfig;
  public state?: DateTimeState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: DateTimeConfig;
    state?: DateTimeState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'DateTimeStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesDateTimeResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesDateTimeResponseSchema;
  }

  protected getStateSchema() {
    return DateTimeStateResponseSchema;
  }

  protected getCommandSchema() {
    return DateTimeCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): DateTimeConfig {
    return protoMessage as DateTimeConfig;
  }

  public parseState(protoMessage: unknown): DateTimeState {
    return protoMessage as DateTimeState;
  }

  protected createCommand(commandData: DateTimeCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setState(state: string): Promise<void> {
    // Validate datetime format (YYYY-MM-DDTHH:MM:SS)
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
    if (!dateTimeRegex.test(state)) {
      throw new Error(
        `Invalid datetime format: ${state}. Expected YYYY-MM-DDTHH:MM:SS`,
      );
    }
    await this.command({ state });
  }

  private async command(params: DateTimeCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's dateTimeCommand method
    await this.connection.dateTimeCommand(this.config.key, params.state);
  }
}

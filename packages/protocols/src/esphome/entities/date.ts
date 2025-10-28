import type { ESPHomeConnection } from '../connection';
import {
  DateCommandRequestSchema,
  DateStateResponseSchema,
  ListEntitiesDateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface DateConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
}

export interface DateState extends EntityState {
  state: string; // Date in YYYY-MM-DD format
}

export interface DateCommand {
  state: string; // Date in YYYY-MM-DD format
}

export class DateEntity extends BaseEntity<DateConfig, DateState> {
  public config: DateConfig;
  public state?: DateState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: DateConfig;
    state?: DateState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'DateStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesDateResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesDateResponseSchema;
  }

  protected getStateSchema() {
    return DateStateResponseSchema;
  }

  protected getCommandSchema() {
    return DateCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): DateConfig {
    return protoMessage as DateConfig;
  }

  public parseState(protoMessage: unknown): DateState {
    return protoMessage as DateState;
  }

  protected createCommand(commandData: DateCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setState(state: string): Promise<void> {
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(state)) {
      throw new Error(`Invalid date format: ${state}. Expected YYYY-MM-DD`);
    }
    await this.command({ state });
  }

  private async command(params: DateCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's dateCommand method
    await this.connection.dateCommand(this.config.key, params.state);
  }
}

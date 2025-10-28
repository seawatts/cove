import type { ESPHomeConnection } from '../connection';
import {
  ListEntitiesSelectResponseSchema,
  SelectCommandRequestSchema,
  SelectStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface SelectConfig extends EntityConfig {
  icon: string;
  options: string[];
  disabledByDefault: boolean;
  entityCategory: number;
}

export interface SelectState extends EntityState {
  state: string;
}

export interface SelectCommand {
  state: string;
}

export class SelectEntity extends BaseEntity<SelectConfig, SelectState> {
  public config: SelectConfig;
  public state?: SelectState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: SelectConfig;
    state?: SelectState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'SelectStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesSelectResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesSelectResponseSchema;
  }

  protected getStateSchema() {
    return SelectStateResponseSchema;
  }

  protected getCommandSchema() {
    return SelectCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): SelectConfig {
    return protoMessage as SelectConfig;
  }

  public parseState(protoMessage: unknown): SelectState {
    return protoMessage as SelectState;
  }

  protected createCommand(commandData: SelectCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setState(state: string): Promise<void> {
    if (this.config.options && !this.config.options.includes(state)) {
      throw new Error(`state(${state}) is not supported`);
    }
    await this.command({ state });
  }

  private async command(params: SelectCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's selectCommand method
    await this.connection.selectCommand(this.config.key, params.state);
  }
}

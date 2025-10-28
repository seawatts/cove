import type { ESPHomeConnection } from '../connection';
import type { TextMode } from '../protoc/api_pb';
import {
  ListEntitiesTextResponseSchema,
  TextCommandRequestSchema,
  TextStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface TextConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
  minLength: number;
  maxLength: number;
  pattern: string;
  mode: TextMode;
}

export interface TextState extends EntityState {
  state: string;
}

export interface TextCommand {
  state: string;
}

export class TextEntity extends BaseEntity<TextConfig, TextState> {
  public config: TextConfig;
  public state?: TextState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: TextConfig;
    state?: TextState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'TextStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesTextResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesTextResponseSchema;
  }

  protected getStateSchema() {
    return TextStateResponseSchema;
  }

  protected getCommandSchema() {
    return TextCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): TextConfig {
    return protoMessage as TextConfig;
  }

  public parseState(protoMessage: unknown): TextState {
    return protoMessage as TextState;
  }

  protected createCommand(commandData: TextCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setState(state: string): Promise<void> {
    if (state.length < this.config.minLength) {
      throw new Error(
        `state(${state}) is less than the minimum(${this.config.minLength})`,
      );
    }
    if (state.length > this.config.maxLength) {
      throw new Error(
        `state(${state}) is greater than the maximum(${this.config.maxLength})`,
      );
    }
    await this.command({ state });
  }

  private async command(params: TextCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's textCommand method
    await this.connection.textCommand(this.config.key, params.state);
  }
}

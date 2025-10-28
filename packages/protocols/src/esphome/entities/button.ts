import type { ESPHomeConnection } from '../connection';
import {
  ButtonCommandRequestSchema,
  ListEntitiesButtonResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface ButtonConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
  deviceClass: string;
  deviceId: number;
}

// Buttons don't have state responses, they only send commands
export interface ButtonState extends EntityState {}

export class ButtonEntity extends BaseEntity<ButtonConfig, ButtonState> {
  public config: ButtonConfig;
  public state?: ButtonState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: ButtonConfig;
    state?: ButtonState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'ButtonStateResponse'; // Buttons don't actually have state responses
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesButtonResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesButtonResponseSchema;
  }

  protected getStateSchema() {
    // Buttons don't have state schemas
    return null as unknown;
  }

  protected getCommandSchema() {
    return ButtonCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): ButtonConfig {
    return protoMessage as ButtonConfig;
  }

  public parseState(protoMessage: unknown): ButtonState {
    return protoMessage as ButtonState;
  }

  protected createCommand(): unknown {
    return {
      key: this.config.key,
    };
  }

  // Command methods
  async press(): Promise<void> {
    await this.command();
  }

  private async command(): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's buttonCommand method
    await this.connection.buttonCommand(this.config.key);
  }
}

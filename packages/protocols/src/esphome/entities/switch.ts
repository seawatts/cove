import type { ESPHomeConnection } from '../connection';
import {
  ListEntitiesSwitchResponseSchema,
  SwitchCommandRequestSchema,
  SwitchStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface SwitchConfig extends EntityConfig {
  icon: string;
  assumedState: boolean;
  disabledByDefault: boolean;
  entityCategory: number;
  deviceClass: string;
  deviceId: number;
}

export interface SwitchState extends EntityState {
  state: boolean;
  deviceId: number;
}

export interface SwitchCommand {
  state: boolean;
}

export class SwitchEntity extends BaseEntity<SwitchConfig, SwitchState> {
  public config: SwitchConfig;
  public state?: SwitchState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: SwitchConfig;
    state?: SwitchState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'SwitchStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesSwitchResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesSwitchResponseSchema;
  }

  protected getStateSchema() {
    return SwitchStateResponseSchema;
  }

  protected getCommandSchema() {
    return SwitchCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): SwitchConfig {
    return protoMessage as SwitchConfig;
  }

  public parseState(protoMessage: unknown): SwitchState {
    return protoMessage as SwitchState;
  }

  protected createCommand(commandData: SwitchCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setState(state: boolean): Promise<void> {
    await this.command({ state });
  }

  private async command(params: SwitchCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's switchCommand method
    await this.connection.switchCommand(this.config.key, params.state);
  }
}

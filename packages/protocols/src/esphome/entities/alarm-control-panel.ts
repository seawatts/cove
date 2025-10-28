import type { ESPHomeConnection } from '../connection';
import type { AlarmControlPanelStateCommand } from '../protoc/api_pb';
import {
  AlarmControlPanelCommandRequestSchema,
  AlarmControlPanelStateResponseSchema,
  ListEntitiesAlarmControlPanelResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface AlarmControlPanelConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
}

export interface AlarmControlPanelState extends EntityState {
  state: AlarmControlPanelStateCommand;
}

export interface AlarmControlPanelCommandParams {
  command: AlarmControlPanelStateCommand;
}

export class AlarmControlPanelEntity extends BaseEntity<
  AlarmControlPanelConfig,
  AlarmControlPanelState
> {
  public config: AlarmControlPanelConfig;
  public state?: AlarmControlPanelState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: AlarmControlPanelConfig;
    state?: AlarmControlPanelState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'AlarmControlPanelStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesAlarmControlPanelResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesAlarmControlPanelResponseSchema;
  }

  protected getStateSchema() {
    return AlarmControlPanelStateResponseSchema;
  }

  protected getCommandSchema() {
    return AlarmControlPanelCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): AlarmControlPanelConfig {
    return protoMessage as AlarmControlPanelConfig;
  }

  public parseState(protoMessage: unknown): AlarmControlPanelState {
    return protoMessage as AlarmControlPanelState;
  }

  protected createCommand(
    commandData: AlarmControlPanelCommandParams,
  ): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setCommand(command: AlarmControlPanelStateCommand): Promise<void> {
    await this.command({ command });
  }

  private async command(params: AlarmControlPanelCommandParams): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's alarmControlPanelCommand method
    await this.connection.alarmControlPanelCommand(
      this.config.key,
      params.command,
    );
  }
}

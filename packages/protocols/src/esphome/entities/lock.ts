import type { ESPHomeConnection } from '../connection';
import {
  ListEntitiesLockResponseSchema,
  LockCommand,
  LockCommandRequestSchema,
  LockStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface LockConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
  assumedState: boolean;
  supportsOpen: boolean;
  requiresCode: boolean;
  codeFormat: string;
}

export interface LockState extends EntityState {
  state: LockCommand;
}

export interface LockCommandParams {
  command: LockCommand;
  code?: string;
}

export class LockEntity extends BaseEntity<LockConfig, LockState> {
  public config: LockConfig;
  public state?: LockState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: LockConfig;
    state?: LockState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'LockStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesLockResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesLockResponseSchema;
  }

  protected getStateSchema() {
    return LockStateResponseSchema;
  }

  protected getCommandSchema() {
    return LockCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): LockConfig {
    return protoMessage as LockConfig;
  }

  public parseState(protoMessage: unknown): LockState {
    return protoMessage as LockState;
  }

  protected createCommand(commandData: LockCommandParams): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setCommand(command: LockCommand, code?: string): Promise<void> {
    if (command === LockCommand.LOCK_OPEN && !this.config.supportsOpen) {
      throw new Error('lock open is not supported');
    }
    await this.command({ code, command });
  }

  async setCode(code: string): Promise<void> {
    if (!this.config.requiresCode) {
      throw new Error('code is not required');
    }
    await this.command({ code, command: LockCommand.LOCK_UNLOCK });
  }

  private async command(params: LockCommandParams): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's lockCommand method
    await this.connection.lockCommand(
      this.config.key,
      params.command,
      params.code,
    );
  }
}

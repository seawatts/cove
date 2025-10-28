import type { ESPHomeConnection } from '../connection';
import type { LegacyCoverCommand } from '../protoc/api_pb';
import {
  CoverCommandRequestSchema,
  CoverStateResponseSchema,
  ListEntitiesCoverResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface CoverConfig extends EntityConfig {
  assumedState: boolean;
  supportsPosition: boolean;
  supportsTilt: boolean;
  deviceClass: string;
  disabledByDefault: boolean;
  icon: string;
  entityCategory: number;
  supportsStop: boolean;
}

export interface CoverState extends EntityState {
  hasLegacyCommand: boolean;
  legacyCommand: LegacyCoverCommand;
  hasPosition: boolean;
  position: number;
  hasTilt: boolean;
  tilt: number;
  stop: boolean;
}

export interface CoverCommand {
  legacyCommand?: LegacyCoverCommand;
  position?: number;
  tilt?: number;
  stop?: boolean;
}

export class CoverEntity extends BaseEntity<CoverConfig, CoverState> {
  public config: CoverConfig;
  public state?: CoverState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: CoverConfig;
    state?: CoverState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'CoverStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesCoverResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesCoverResponseSchema;
  }

  protected getStateSchema() {
    return CoverStateResponseSchema;
  }

  protected getCommandSchema() {
    return CoverCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): CoverConfig {
    return protoMessage as CoverConfig;
  }

  public parseState(protoMessage: unknown): CoverState {
    return protoMessage as CoverState;
  }

  protected createCommand(commandData: CoverCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setLegacyCommand(legacyCommand: LegacyCoverCommand): Promise<void> {
    await this.command({ legacyCommand });
  }

  async setPosition(position: number): Promise<void> {
    if (!this.config.supportsPosition) {
      throw new Error('position is not supported');
    }
    await this.command({ position });
  }

  async setTilt(tilt: number): Promise<void> {
    if (!this.config.supportsTilt) {
      throw new Error('tilt is not supported');
    }
    await this.command({ tilt });
  }

  async setStop(stop: boolean): Promise<void> {
    await this.command({ stop });
  }

  private async command(params: CoverCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's coverCommand method
    await this.connection.coverCommand(this.config.key, params);
  }
}

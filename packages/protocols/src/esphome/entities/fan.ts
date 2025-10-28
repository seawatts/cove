import type { ESPHomeConnection } from '../connection';
import type { FanDirection, FanSpeed } from '../protoc/api_pb';
import {
  FanCommandRequestSchema,
  FanStateResponseSchema,
  ListEntitiesFanResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface FanConfig extends EntityConfig {
  supportsOscillation: boolean;
  supportsSpeed: boolean;
  supportsDirection: boolean;
  supportedSpeedLevels: number;
  disabledByDefault: boolean;
  icon: string;
  entityCategory: number;
}

export interface FanState extends EntityState {
  hasState: boolean;
  state: boolean;
  hasSpeed: boolean;
  speed: FanSpeed;
  hasOscillating: boolean;
  oscillating: boolean;
  hasDirection: boolean;
  direction: FanDirection;
  hasSpeedLevel: boolean;
  speedLevel: number;
}

export interface FanCommand {
  state?: boolean;
  speed?: FanSpeed;
  oscillating?: boolean;
  direction?: FanDirection;
  speedLevel?: number;
}

export class FanEntity extends BaseEntity<FanConfig, FanState> {
  public config: FanConfig;
  public state?: FanState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: FanConfig;
    state?: FanState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'FanStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesFanResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesFanResponseSchema;
  }

  protected getStateSchema() {
    return FanStateResponseSchema;
  }

  protected getCommandSchema() {
    return FanCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): FanConfig {
    return protoMessage as FanConfig;
  }

  public parseState(protoMessage: unknown): FanState {
    return protoMessage as FanState;
  }

  protected createCommand(commandData: FanCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setState(state: boolean): Promise<void> {
    await this.command({ state });
  }

  async setOscillation(oscillating: boolean): Promise<void> {
    if (!this.config.supportsOscillation) {
      throw new Error('oscillation is not supported');
    }
    await this.command({ oscillating });
  }

  async setSpeed(speed: FanSpeed): Promise<void> {
    if (!this.config.supportsSpeed) {
      throw new Error('speed is not supported');
    }
    await this.command({ speed });
  }

  async setDirection(direction: FanDirection): Promise<void> {
    if (!this.config.supportsDirection) {
      throw new Error('direction is not supported');
    }
    await this.command({ direction });
  }

  async setSpeedLevel(speedLevel: number): Promise<void> {
    if (this.config.supportedSpeedLevels <= 0) {
      throw new Error('speed level is not supported');
    }
    await this.command({ speedLevel });
  }

  private async command(params: FanCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's fanCommand method
    await this.connection.fanCommand(this.config.key, params);
  }
}

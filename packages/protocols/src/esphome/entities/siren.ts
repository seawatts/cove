import type { ESPHomeConnection } from '../connection';
import {
  ListEntitiesSirenResponseSchema,
  SirenCommandRequestSchema,
  SirenStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface SirenConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  tones: string[];
  supportsDuration: boolean;
  supportsVolume: boolean;
  entityCategory: number;
}

export interface SirenState extends EntityState {
  hasState: boolean;
  state: boolean;
  hasTone: boolean;
  tone: string;
  hasDuration: boolean;
  duration: number;
  hasVolume: boolean;
  volume: number;
}

export interface SirenCommand {
  state?: boolean;
  tone?: string;
  duration?: number;
  volume?: number;
}

export class SirenEntity extends BaseEntity<SirenConfig, SirenState> {
  public config: SirenConfig;
  public state?: SirenState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: SirenConfig;
    state?: SirenState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'SirenStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesSirenResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesSirenResponseSchema;
  }

  protected getStateSchema() {
    return SirenStateResponseSchema;
  }

  protected getCommandSchema() {
    return SirenCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): SirenConfig {
    return protoMessage as SirenConfig;
  }

  public parseState(protoMessage: unknown): SirenState {
    return protoMessage as SirenState;
  }

  protected createCommand(commandData: SirenCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setState(state: boolean): Promise<void> {
    await this.command({ state });
  }

  async setTone(tone: string): Promise<void> {
    if (!this.config.tones) {
      throw new Error('tones are not supported');
    }
    if (!this.config.tones.includes(tone)) {
      throw new Error(`tone(${tone}) is not supported`);
    }
    await this.command({ tone });
  }

  async setDuration(duration: number): Promise<void> {
    if (!this.config.supportsDuration) {
      throw new Error('duration is not supported');
    }
    await this.command({ duration });
  }

  async setVolume(volume: number): Promise<void> {
    if (!this.config.supportsVolume) {
      throw new Error('volume is not supported');
    }
    await this.command({ volume });
  }

  private async command(params: SirenCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's sirenCommand method
    await this.connection.sirenCommand(this.config.key, params);
  }
}

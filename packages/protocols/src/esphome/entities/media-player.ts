import type { ESPHomeConnection } from '../connection';
import {
  ListEntitiesMediaPlayerResponseSchema,
  MediaPlayerCommand,
  MediaPlayerCommandRequestSchema,
  MediaPlayerStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface MediaPlayerConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
  supportsPause: boolean;
}

export interface MediaPlayerState extends EntityState {
  hasCommand: boolean;
  command: MediaPlayerCommand;
  hasVolume: boolean;
  volume: number;
  hasMediaUrl: boolean;
  mediaUrl: string;
}

export interface MediaPlayerCommandParams {
  command?: MediaPlayerCommand;
  volume?: number;
  mediaUrl?: string;
}

export class MediaPlayerEntity extends BaseEntity<
  MediaPlayerConfig,
  MediaPlayerState
> {
  public config: MediaPlayerConfig;
  public state?: MediaPlayerState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: MediaPlayerConfig;
    state?: MediaPlayerState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'MediaPlayerStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesMediaPlayerResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesMediaPlayerResponseSchema;
  }

  protected getStateSchema() {
    return MediaPlayerStateResponseSchema;
  }

  protected getCommandSchema() {
    return MediaPlayerCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): MediaPlayerConfig {
    return protoMessage as MediaPlayerConfig;
  }

  public parseState(protoMessage: unknown): MediaPlayerState {
    return protoMessage as MediaPlayerState;
  }

  protected createCommand(commandData: MediaPlayerCommandParams): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setCommand(command: MediaPlayerCommand): Promise<void> {
    if (command === MediaPlayerCommand.PAUSE && !this.config.supportsPause) {
      throw new Error('pause is not supported');
    }
    await this.command({ command });
  }

  async setVolume(volume: number): Promise<void> {
    await this.command({ volume });
  }

  async setMediaUrl(mediaUrl: string): Promise<void> {
    await this.command({ mediaUrl });
  }

  private async command(params: MediaPlayerCommandParams): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's mediaPlayerCommand method
    await this.connection.mediaPlayerCommand(this.config.key, params);
  }
}

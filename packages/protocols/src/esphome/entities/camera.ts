import type { ESPHomeConnection } from '../connection';
import {
  CameraImageResponseSchema,
  ListEntitiesCameraResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface CameraConfig extends EntityConfig {
  disabledByDefault: boolean;
  entityCategory: number;
}

export interface CameraState extends EntityState {
  data: Uint8Array;
  done: boolean;
}

export class CameraEntity extends BaseEntity<CameraConfig, CameraState> {
  public config: CameraConfig;
  public state?: CameraState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: CameraConfig;
    state?: CameraState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'CameraImageResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesCameraResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesCameraResponseSchema;
  }

  protected getStateSchema() {
    return CameraImageResponseSchema;
  }

  protected getCommandSchema() {
    // Camera is read-only, no commands
    return null;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): CameraConfig {
    return protoMessage as CameraConfig;
  }

  public parseState(protoMessage: unknown): CameraState {
    return protoMessage as CameraState;
  }

  protected createCommand(): unknown {
    // Camera is read-only, no commands
    throw new Error('Camera does not support commands');
  }

  // Special method for requesting images
  async requestImage(): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's cameraImageRequest method
    await this.connection.cameraImageRequest(this.config.key);
  }
}

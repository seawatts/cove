import type { ESPHomeConnection } from '../connection';
import {
  ListEntitiesUpdateResponseSchema,
  UpdateCommandRequestSchema,
  UpdateStateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface UpdateConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
}

export interface UpdateState extends EntityState {
  state: string; // Update state (idle, installing, etc.)
}

export interface UpdateCommand {
  // Update entities typically don't have commands, but keeping interface for consistency
  // This interface is intentionally empty as Update entities are read-only
  readonly _placeholder?: never; // Prevents empty interface linting error
}

export class UpdateEntity extends BaseEntity<UpdateConfig, UpdateState> {
  public config: UpdateConfig;
  public state?: UpdateState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: UpdateConfig;
    state?: UpdateState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'UpdateStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesUpdateResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesUpdateResponseSchema;
  }

  protected getStateSchema() {
    return UpdateStateResponseSchema;
  }

  protected getCommandSchema() {
    return UpdateCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): UpdateConfig {
    return protoMessage as UpdateConfig;
  }

  public parseState(protoMessage: unknown): UpdateState {
    return protoMessage as UpdateState;
  }

  protected createCommand(): unknown {
    // Update entities typically don't support commands
    throw new Error('Update entity does not support commands');
  }
}

import { EventEmitter } from 'node:events';
import type { ESPHomeConnection } from '../connection';

export interface EntityConfig {
  key: number;
  name: string;
  objectId: string;
  uniqueId: string;
  icon?: string;
  disabledByDefault?: boolean;
  entityCategory?: number;
}

export interface EntityState {
  key: number;
  missingState?: boolean;
}

// Generic entity types for type-safe implementations
export interface TypedEntityConfig<T = unknown> extends EntityConfig {
  [key: string]: T | string | number | boolean | undefined;
}

export interface TypedEntityState<T = unknown> extends EntityState {
  [key: string]: T | string | number | boolean | undefined;
}

export abstract class BaseEntity<
  TConfig extends EntityConfig = EntityConfig,
  TState extends EntityState = EntityState,
> extends EventEmitter {
  protected connection?: ESPHomeConnection;
  public config: TConfig;
  public state?: TState;
  public type: string;
  public name: string;
  public id: number;
  public destroyed = false;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: TConfig;
    state?: TState;
  }) {
    super();

    if (!config) throw new Error('config is required');
    this.config = config;
    this.type = this.constructor.name;
    this.name = config.name;
    this.id = config.key;

    if (connection) this.attachConnection(connection);
    if (state) this.handleState(state);
  }

  // Sync methods
  attachConnection(connection: ESPHomeConnection): void {
    if (this.connection) {
      this.detachConnection();
    }
    this.connection = connection;
    // Listen for state messages for this entity type
    this.connection.on(
      `message.${(this.constructor as typeof BaseEntity).getStateResponseName()}`,
      this.handleMessage,
    );
  }

  detachConnection(): void {
    if (!this.connection) throw new Error('Connection is not attached');
    this.connection.off(
      `message.${(this.constructor as typeof BaseEntity).getStateResponseName()}`,
      this.handleMessage,
    );
    this.connection = undefined;
  }

  destroy(): void {
    this.detachConnection();
    this.destroyed = true;
    this.emit('destroyed');
  }

  // Abstract static methods to be implemented by subclasses
  static getStateResponseName(): string {
    return `${BaseEntity.name}StateResponse`;
  }

  static getListEntitiesResponseName(): string {
    return `ListEntities${BaseEntity.name}Response`;
  }

  // Handlers
  protected handleState = (state: TState): void => {
    this.state = state;
    this.emit('state', state);
  };

  protected handleMessage = (state: TState): void => {
    if (state.key !== this.id) return;
    this.handleState(state);
  };

  // Helper method to update state from external sources
  updateState(newState: TState): void {
    this.handleState(newState);
  }

  /**
   * Get the protobuf schema for this entity's configuration
   * Override in subclasses to provide type-safe configuration
   */
  protected abstract getConfigSchema(): unknown;

  /**
   * Get the protobuf schema for this entity's state
   * Override in subclasses to provide type-safe state
   */
  protected abstract getStateSchema(): unknown;

  /**
   * Get the protobuf schema for this entity's command
   * Override in subclasses to provide type-safe commands
   */
  protected abstract getCommandSchema(): unknown;

  /**
   * Parse configuration from protobuf message
   */
  public parseConfig(protoMessage: unknown): TConfig {
    // Default implementation - override in subclasses for type safety
    return protoMessage as TConfig;
  }

  /**
   * Parse state from protobuf message
   */
  public parseState(protoMessage: unknown): TState {
    // Default implementation - override in subclasses for type safety
    return protoMessage as TState;
  }

  /**
   * Create a command message for this entity
   */
  protected createCommand(commandData: unknown): unknown {
    // Default implementation - override in subclasses for type safety
    return commandData;
  }
}

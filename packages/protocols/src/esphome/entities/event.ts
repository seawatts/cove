import type { ESPHomeConnection } from '../connection';
import {
  EventResponseSchema,
  ListEntitiesEventResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface EventConfig extends EntityConfig {
  icon: string;
  disabledByDefault: boolean;
  entityCategory: number;
}

export interface EventState extends EntityState {
  eventType: string;
  deviceId: number;
}

export class EventEntity extends BaseEntity<EventConfig, EventState> {
  public config: EventConfig;
  public state?: EventState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: EventConfig;
    state?: EventState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'EventResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesEventResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesEventResponseSchema;
  }

  protected getStateSchema() {
    return EventResponseSchema;
  }

  protected getCommandSchema() {
    // Event entities are read-only triggers, no commands
    return null;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): EventConfig {
    return protoMessage as EventConfig;
  }

  public parseState(protoMessage: unknown): EventState {
    return protoMessage as EventState;
  }

  protected createCommand(): unknown {
    // Event entities are read-only triggers, no commands
    throw new Error('Event entity does not support commands');
  }
}

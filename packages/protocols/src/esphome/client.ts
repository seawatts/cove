/**
 * ESPHome Native API Client
 * Mirrors the reference JavaScript implementation
 */

import { EventEmitter } from 'node:events';
import { debug } from '@cove/logger';

const log = debug('cove:esphome:client');

import {
  type ConnectionOptions,
  type DeviceInfoResponse,
  ESPHomeConnection,
} from './connection';
import { type BaseEntity, createEntity } from './entities';
import {
  ButtonCommandRequestSchema,
  LightCommandRequestSchema,
  NumberCommandRequestSchema,
  SwitchCommandRequestSchema,
} from './protoc/api_pb';

export interface ESPHomeClientOptions extends ConnectionOptions {
  clearSession?: boolean;
  initializeDeviceInfo?: boolean;
  initializeListEntities?: boolean;
  initializeSubscribeStates?: boolean;
  initializeSubscribeLogs?: boolean | { level?: number; dumpConfig?: boolean };
  initializeSubscribeBLEAdvertisements?: boolean;
}

export class ESPHomeNativeClient extends EventEmitter {
  private connection: ESPHomeConnection;
  private entities: Record<number, BaseEntity> = {};
  private _connected = false;
  private _initialized = false;
  private _subscribeBLEAdvertisements = false;
  private _deviceInfo: DeviceInfoResponse | undefined;
  private _eventHandlers: Map<string, (...args: unknown[]) => void> = new Map();

  constructor(options: ESPHomeClientOptions) {
    super();
    this.propagateError = this.propagateError.bind(this);

    const {
      clearSession = true,
      initializeDeviceInfo = true,
      initializeListEntities = true,
      initializeSubscribeStates = true,
      initializeSubscribeLogs = false,
      initializeSubscribeBLEAdvertisements = false,
      ...config
    } = options;

    this.connection = new ESPHomeConnection(config);

    this.addEventHandler('authorized', async () => {
      this.connected = true;
      try {
        this._initialized = false;
        if (clearSession) {
          for (const id of Object.keys(this.entities)) {
            this.removeEntity(Number(id));
          }
        }
        if (initializeDeviceInfo) {
          await this.connection.deviceInfoService();
        }
        if (initializeListEntities) {
          await this.connection.listEntitiesService();
        }
        if (initializeSubscribeStates) {
          this.connection.subscribeStatesService();
        }
        if (initializeSubscribeLogs) {
          const level =
            initializeSubscribeLogs === true
              ? 0
              : (initializeSubscribeLogs.level ?? 0);
          const dumpConfig =
            initializeSubscribeLogs === true
              ? false
              : (initializeSubscribeLogs.dumpConfig ?? false);
          await this.connection.subscribeLogsService(level, dumpConfig);
        }
        if (initializeSubscribeBLEAdvertisements) {
          await this.connection.subscribeBluetoothAdvertisementService();
        }
        this._initialized = true;
        this.emit('initialized');
      } catch (e) {
        this.emit('error', e);
        if (this.connection.connected) {
          this.connection.disconnect();
        }
      }
    });

    this.addEventHandler('unauthorized', async () => {
      this.connected = false;
      this._initialized = false;
    });

    this.addEventHandler(
      'message.DeviceInfoResponse',
      async (deviceInfo: unknown) => {
        this._deviceInfo = deviceInfo as DeviceInfoResponse;
        this.emit('deviceInfo', deviceInfo);
      },
    );

    // Listen for entity creation messages
    this.addEventHandler(
      'message.ListEntitiesBinarySensorResponse',
      async (config: any) => {
        try {
          if (!this.entities[config.key]) {
            this.addEntity('BinarySensor', config);
          }
        } catch (error) {
          log('Failed to create BinarySensor entity:', error);
        }
      },
    );

    this.addEventHandler(
      'message.ListEntitiesButtonResponse',
      async (config: any) => {
        try {
          if (!this.entities[config.key]) {
            this.addEntity('Button', config);
          }
        } catch (error) {
          log('Failed to create Button entity:', error);
        }
      },
    );

    this.addEventHandler(
      'message.ListEntitiesLightResponse',
      async (config: any) => {
        try {
          if (!this.entities[config.key]) {
            this.addEntity('Light', config);
          }
        } catch (error) {
          log('Failed to create Light entity:', error);
        }
      },
    );

    this.addEventHandler(
      'message.ListEntitiesNumberResponse',
      async (config: any) => {
        try {
          if (!this.entities[config.key]) {
            this.addEntity('Number', config);
          }
        } catch (error) {
          log('Failed to create Number entity:', error);
        }
      },
    );

    this.addEventHandler(
      'message.ListEntitiesSensorResponse',
      async (config: any) => {
        try {
          if (!this.entities[config.key]) {
            this.addEntity('Sensor', config);
          }
        } catch (error) {
          log('Failed to create Sensor entity:', error);
        }
      },
    );

    this.addEventHandler(
      'message.ListEntitiesSwitchResponse',
      async (config: any) => {
        try {
          if (!this.entities[config.key]) {
            this.addEntity('Switch', config);
          }
        } catch (error) {
          log('Failed to create Switch entity:', error);
        }
      },
    );

    this.addEventHandler(
      'message.ListEntitiesTextSensorResponse',
      async (config: any) => {
        try {
          if (!this.entities[config.key]) {
            this.addEntity('TextSensor', config);
          }
        } catch (error) {
          log('Failed to create TextSensor entity:', error);
        }
      },
    );

    this.addEventHandler(
      'message.ListEntitiesFanResponse',
      async (config: any) => {
        try {
          if (!this.entities[config.key]) {
            this.addEntity('Fan', config);
          }
        } catch (error) {
          log('Failed to create Fan entity:', error);
        }
      },
    );

    this.addEventHandler(
      'message.ListEntitiesClimateResponse',
      async (config: any) => {
        try {
          if (!this.entities[config.key]) {
            this.addEntity('Climate', config);
          }
        } catch (error) {
          log('Failed to create Climate entity:', error);
        }
      },
    );

    this.addEventHandler(
      'message.ListEntitiesCoverResponse',
      async (config: any) => {
        try {
          if (!this.entities[config.key]) {
            this.addEntity('Cover', config);
          }
        } catch (error) {
          log('Failed to create Cover entity:', error);
        }
      },
    );

    // State response handlers
    this.addEventHandler('message.SensorStateResponse', async (state: any) => {
      const entity = this.entities[state.key];
      if (entity) {
        entity.updateState(state);
      }
    });

    this.addEventHandler(
      'message.BinarySensorStateResponse',
      async (state: any) => {
        const entity = this.entities[state.key];
        if (entity) {
          entity.updateState(state);
        }
      },
    );

    this.addEventHandler('message.SwitchStateResponse', async (state: any) => {
      const entity = this.entities[state.key];
      if (entity) {
        entity.updateState(state);
      }
    });

    this.addEventHandler(
      'message.TextSensorStateResponse',
      async (state: any) => {
        const entity = this.entities[state.key];
        if (entity) {
          entity.updateState(state);
        }
      },
    );

    this.addEventHandler('message.LightStateResponse', async (state: any) => {
      const entity = this.entities[state.key];
      if (entity) {
        entity.updateState(state);
      }
    });

    this.addEventHandler('message.FanStateResponse', async (state: any) => {
      const entity = this.entities[state.key];
      if (entity) {
        entity.updateState(state);
      }
    });

    this.addEventHandler('message.CoverStateResponse', async (state: any) => {
      const entity = this.entities[state.key];
      if (entity) {
        entity.updateState(state);
      }
    });

    this.addEventHandler('message.ClimateStateResponse', async (state: any) => {
      const entity = this.entities[state.key];
      if (entity) {
        entity.updateState(state);
      }
    });

    this.addEventHandler('message.SubscribeLogsResponse', async (data) => {
      this.emit('logs', data);
    });

    this.addEventHandler(
      'message.BluetoothLEAdvertisementResponse',
      async (data) => {
        this.emit('ble', data);
      },
    );

    this.addEventHandler('error', async (e) => {
      this.emit('error', e);
    });

    // Listen for entity discovery completion
    this.addEventHandler('entitiesComplete', () => {
      const entityMap = new Map();
      for (const [key, entity] of Object.entries(this.entities)) {
        entityMap.set(Number(key), entity);
      }
      this.emit('entitiesComplete', entityMap);
    });

    this._subscribeBLEAdvertisements = initializeSubscribeBLEAdvertisements;
  }

  set connected(value: boolean) {
    if (this._connected === value) return;
    this._connected = value;
    this.emit(this._connected ? 'connected' : 'disconnected');
  }

  get connected(): boolean {
    return this._connected;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  get deviceInfo(): DeviceInfoResponse | undefined {
    return this._deviceInfo;
  }

  connect(): void {
    this.connection.connect();
  }

  disconnect(): void {
    if (this.connection.connected && this._subscribeBLEAdvertisements) {
      this.connection.unsubscribeBluetoothAdvertisementService();
    }
    this.removeEventHandlers();
    this.connection.disconnect();
  }

  private addEventHandler(
    eventName: string,
    handler: (...args: unknown[]) => void,
  ): void {
    this._eventHandlers.set(eventName, handler);
    this.connection.on(eventName, handler);
  }

  private removeEventHandlers(): void {
    for (const [eventName, handler] of this._eventHandlers.entries()) {
      this.connection.off(eventName, handler);
    }
    this._eventHandlers.clear();
  }

  addEntity(entityClassName: string, config: Record<string, unknown>): void {
    const configObj = config as { key: number };
    if (this.entities[configObj.key]) {
      throw new Error(
        `Entity with id(i.e key) ${configObj.key} is already added`,
      );
    }
    this.entities[configObj.key] = createEntity(
      entityClassName,
      this.connection,
      config,
    );
    const entity = this.entities[configObj.key];
    if (entity) {
      entity.on('error', () => this.propagateError(new Error('Entity error')));

      // Listen for state changes and emit generic events
      entity.on('state', (state: any) => {
        this.emit('entityState', {
          entity,
          state,
        });
      });

      this.emit('newEntity', this.entities[configObj.key]);
    }
  }

  removeEntity(id: number): void {
    if (!this.entities[id]) {
      throw new Error(`Cannot find entity with id(i.e. key) ${id}`);
    }
    const entity = this.entities[id];
    entity.destroy();
    entity.off('error', () => this.propagateError(new Error('Entity error')));
    delete this.entities[id];
  }

  private propagateError(e: unknown): void {
    this.emit('error', e);
  }

  // Type-safe convenience methods that delegate to the connection
  async lightCommand(
    key: number,
    command: Record<string, unknown>,
  ): Promise<void> {
    return this.connection.sendMessage(
      { key, ...command },
      LightCommandRequestSchema,
    );
  }

  async switchCommand(key: number, state: boolean): Promise<void> {
    return this.connection.sendMessage(
      { key, state },
      SwitchCommandRequestSchema,
    );
  }

  async numberCommand(key: number, state: number): Promise<void> {
    return this.connection.sendMessage(
      { key, state },
      NumberCommandRequestSchema,
    );
  }

  async buttonCommand(key: number): Promise<void> {
    return this.connection.sendMessage({ key }, ButtonCommandRequestSchema);
  }

  getEntities(): BaseEntity[] {
    return Object.values(this.entities);
  }
}

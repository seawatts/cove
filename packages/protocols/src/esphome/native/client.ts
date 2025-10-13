/**
 * Simple ESPHome Native API Client
 * Focused on sensor data retrieval for Apollo Air
 */

import { EventEmitter } from 'node:events';
import { type Socket, connect as tcpConnect } from 'node:net';
import { debug } from '@cove/logger';
import * as commands from './commands';
import * as entities from './entities';
import * as messages from './messages';
import { frameMessage, parseFrame } from './protocol';
import * as states from './states';
import {
  type AnyEntity,
  type ButtonCommand,
  type LightCommand,
  MessageType,
  type NumberCommand,
  type NumberEntity,
  type SensorEntity,
  type SwitchCommand,
} from './types';

const log = debug('cove:esphome:native');

export interface ESPHomeClientOptions {
  host: string;
  port?: number;
  password?: string;
  clientInfo?: string;
}

export class ESPHomeNativeClient extends EventEmitter {
  private socket: Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private connected = false;
  private entities: Map<number, AnyEntity> = new Map();

  constructor(private options: ESPHomeClientOptions) {
    super();
    this.options.port = options.port || 6053;
    this.options.clientInfo = options.clientInfo || 'Cove Hub';
    this.options.password = options.password || '';
  }

  /**
   * Connect to ESPHome device
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      log(`Connecting to ${this.options.host}:${this.options.port}`);

      this.socket = tcpConnect({
        host: this.options.host,
        port: this.options.port || 6053,
      });

      this.socket.on('connect', () => {
        log('TCP connected');
        this.sendHello().catch(reject);
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('error', (error: Error) => {
        log('Socket error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.socket.on('close', () => {
        log('Socket closed');
        this.connected = false;
        this.emit('disconnected');
      });

      // Resolve after successful handshake
      this.once('initialized', () => resolve());
    });
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  /**
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    // Try to parse frames from buffer
    while (this.buffer.length > 0) {
      try {
        const result = parseFrame(this.buffer);

        if (!result) {
          // Incomplete frame, wait for more data
          break;
        }

        const { frame, bytesConsumed } = result;
        this.buffer = this.buffer.subarray(bytesConsumed);

        // Handle the message
        this.handleMessage(frame.type, frame.data);
      } catch (error) {
        log('Frame parse error:', error);
        this.emit('error', error);
        break;
      }
    }
  }

  /**
   * Handle a parsed message
   */
  private handleMessage(type: MessageType, data: Buffer): void {
    log(`Received message type: ${type} (${data.length} bytes)`);

    switch (type) {
      case MessageType.HelloResponse:
        this.handleHelloResponse(data);
        break;

      case MessageType.ConnectResponse:
        this.handleConnectResponse(data);
        break;

      case MessageType.DeviceInfoResponse:
        this.handleDeviceInfoResponse(data);
        break;

      case MessageType.ListEntitiesSensorResponse:
        this.handleSensorEntity(data);
        break;

      case MessageType.ListEntitiesBinarySensorResponse:
        this.handleBinarySensorEntity(data);
        break;

      case MessageType.ListEntitiesSwitchResponse:
        this.handleSwitchEntity(data);
        break;

      case MessageType.ListEntitiesLightResponse:
        this.handleLightEntity(data);
        break;

      case MessageType.ListEntitiesButtonResponse:
        this.handleButtonEntity(data);
        break;

      case MessageType.ListEntitiesNumberResponse:
        this.handleNumberEntity(data);
        break;

      case MessageType.ListEntitiesTextSensorResponse:
        this.handleTextSensorEntity(data);
        break;

      case MessageType.ListEntitiesDoneResponse:
        this.handleEntitiesDone();
        break;

      case MessageType.SensorStateResponse:
        this.handleSensorState(data);
        break;

      case MessageType.BinarySensorStateResponse:
        this.handleBinarySensorState(data);
        break;

      case MessageType.SwitchStateResponse:
        this.handleSwitchState(data);
        break;

      case MessageType.LightStateResponse:
        this.handleLightState(data);
        break;

      case MessageType.NumberStateResponse:
        this.handleNumberState(data);
        break;

      case MessageType.TextSensorStateResponse:
        this.handleTextSensorState(data);
        break;

      case MessageType.PingRequest:
        this.sendPingResponse();
        break;

      default:
        log(`Unhandled message type: ${type}`);
    }
  }

  /**
   * Send a message
   */
  private send(type: MessageType, payload: Buffer): void {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    const frame = frameMessage(type, payload);
    this.socket.write(frame);
    log(`Sent message type: ${type} (${payload.length} bytes)`);
  }

  /**
   * Protocol sequence: Hello
   */
  private async sendHello(): Promise<void> {
    const payload = messages.buildHelloRequest(
      this.options.clientInfo || 'Cove Hub',
    );
    this.send(MessageType.HelloRequest, payload);
  }

  private handleHelloResponse(data: Buffer): void {
    const response = messages.parseHelloResponse(data);
    log('Hello response:', response);
    this.emit('hello', response);

    // Next step: Connect
    this.sendConnect();
  }

  /**
   * Protocol sequence: Connect
   */
  private sendConnect(): void {
    const payload = messages.buildConnectRequest(this.options.password || '');
    this.send(MessageType.ConnectRequest, payload);
  }

  private handleConnectResponse(data: Buffer): void {
    const response = messages.parseConnectResponse(data);

    if (response.invalidPassword) {
      this.emit('error', new Error('Invalid password'));
      return;
    }

    log('Connected successfully');
    this.connected = true;
    this.emit('connected');

    // Next steps: Get device info, list entities, subscribe to states
    this.sendDeviceInfoRequest();
    this.sendListEntitiesRequest();
  }

  /**
   * Get device info
   */
  private sendDeviceInfoRequest(): void {
    const payload = messages.buildDeviceInfoRequest();
    this.send(MessageType.DeviceInfoRequest, payload);
  }

  private handleDeviceInfoResponse(data: Buffer): void {
    const deviceInfo = messages.parseDeviceInfoResponse(data);
    log('Device info:', deviceInfo);
    this.emit('deviceInfo', deviceInfo);
  }

  /**
   * List entities
   */
  private sendListEntitiesRequest(): void {
    const payload = messages.buildListEntitiesRequest();
    this.send(MessageType.ListEntitiesRequest, payload);
  }

  private handleSensorEntity(data: Buffer): void {
    const entity = messages.parseSensorEntity(data) as SensorEntity;
    if (entity.key) {
      this.entities.set(entity.key, entity);
      log(`Sensor entity: ${entity.name} (key: ${entity.key})`);
      this.emit('entity', entity);
    }
  }

  private handleBinarySensorEntity(data: Buffer): void {
    const entity = messages.parseBinarySensorEntity(data);
    if (entity.key) {
      this.entities.set(entity.key, entity as AnyEntity);
      log(`Binary sensor: ${entity.name} (key: ${entity.key})`);
      this.emit('entity', entity);
    }
  }

  private handleSwitchEntity(data: Buffer): void {
    const entity = entities.parseSwitchEntity(data);
    if (entity.key) {
      this.entities.set(entity.key, entity as AnyEntity);
      log(`Switch: ${entity.name} (key: ${entity.key})`);
      this.emit('entity', entity);
    }
  }

  private handleLightEntity(data: Buffer): void {
    const entity = entities.parseLightEntity(data);
    if (entity.key) {
      this.entities.set(entity.key, entity as AnyEntity);
      log(`Light: ${entity.name} (key: ${entity.key})`);
      this.emit('entity', entity);
    }
  }

  private handleButtonEntity(data: Buffer): void {
    const entity = entities.parseButtonEntity(data);
    if (entity.key) {
      this.entities.set(entity.key, entity as AnyEntity);
      log(`Button: ${entity.name} (key: ${entity.key})`);
      this.emit('entity', entity);
    }
  }

  private handleNumberEntity(data: Buffer): void {
    const entity = entities.parseNumberEntity(data);
    if (entity.key) {
      this.entities.set(entity.key, entity as AnyEntity);
      log(`Number: ${entity.name} (key: ${entity.key})`);
      this.emit('entity', entity);
    }
  }

  private handleTextSensorEntity(data: Buffer): void {
    const entity = entities.parseTextSensorEntity(data);
    if (entity.key) {
      this.entities.set(entity.key, entity as AnyEntity);
      log(`Text sensor: ${entity.name} (key: ${entity.key})`);
      this.emit('entity', entity);
    }
  }

  private handleEntitiesDone(): void {
    log(`Entities list complete: ${this.entities.size} entities`);
    this.emit('entitiesComplete', this.entities);

    // Now subscribe to states
    this.sendSubscribeStatesRequest();
  }

  /**
   * Subscribe to state updates
   */
  private sendSubscribeStatesRequest(): void {
    const payload = messages.buildSubscribeStatesRequest();
    this.send(MessageType.SubscribeStatesRequest, payload);
    log('Subscribed to state updates');
    this.emit('initialized');
  }

  private handleSensorState(data: Buffer): void {
    const state = messages.parseSensorState(data);

    if (state.missingState) {
      return;
    }

    const entity = this.entities.get(state.key) as SensorEntity;
    if (entity) {
      log(
        'Sensor state: %s = %s %s',
        entity.name,
        state.state,
        entity.unitOfMeasurement || '',
      );

      this.emit('sensorState', {
        entity,
        state: state.state,
      });
    }
  }

  private handleBinarySensorState(data: Buffer): void {
    const state = states.parseBinarySensorState(data);
    if (state.missingState) return;

    const entity = this.entities.get(state.key);
    if (entity) {
      log(`Binary sensor state: ${entity.name} = ${state.state}`);
      this.emit('binarySensorState', { entity, state: state.state });
    }
  }

  private handleSwitchState(data: Buffer): void {
    const state = states.parseSwitchState(data);
    const entity = this.entities.get(state.key);
    if (entity) {
      log(`Switch state: ${entity.name} = ${state.state}`);
      this.emit('switchState', { entity, state: state.state });
    }
  }

  private handleLightState(data: Buffer): void {
    const state = states.parseLightState(data);
    const entity = this.entities.get(state.key);
    if (entity) {
      log(`Light state: ${entity.name} = ${state.state ? 'ON' : 'OFF'}`);
      this.emit('lightState', { entity, state });
    }
  }

  private handleNumberState(data: Buffer): void {
    const state = states.parseNumberState(data);
    if (state.missingState) return;

    const entity = this.entities.get(state.key) as NumberEntity;
    if (entity) {
      log(
        'Number state: %s = %s %s',
        entity.name,
        state.state,
        entity.unitOfMeasurement || '',
      );
      this.emit('numberState', { entity, state: state.state });
    }
  }

  private handleTextSensorState(data: Buffer): void {
    const state = states.parseTextSensorState(data);
    if (state.missingState) return;

    const entity = this.entities.get(state.key);
    if (entity) {
      log(`Text sensor state: ${entity.name} = ${state.state}`);
      this.emit('textSensorState', { entity, state: state.state });
    }
  }

  /**
   * Respond to ping
   */
  private sendPingResponse(): void {
    this.send(MessageType.PingResponse, Buffer.alloc(0));
  }

  /**
   * Get all discovered entities
   */
  getEntities(): AnyEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get entities by type
   */
  getEntitiesByType<T extends AnyEntity>(type: string): T[] {
    return Array.from(this.entities.values()).filter(
      (e) => e.type === type,
    ) as T[];
  }

  /**
   * Send switch command
   */
  async switchCommand(key: number, state: boolean): Promise<void> {
    const command: SwitchCommand = { key, state };
    const payload = commands.buildSwitchCommand(command);
    this.send(MessageType.SwitchCommandRequest, payload);
    log(`Sent switch command: key=${key} state=${state}`);
  }

  /**
   * Send light command
   */
  async lightCommand(
    key: number,
    command: Omit<LightCommand, 'key'>,
  ): Promise<void> {
    const fullCommand: LightCommand = { key, ...command };
    const payload = commands.buildLightCommand(fullCommand);
    this.send(MessageType.LightCommandRequest, payload);
    log(`Sent light command: key=${key}`);
  }

  /**
   * Send button press
   */
  async buttonPress(key: number): Promise<void> {
    const command: ButtonCommand = { key };
    const payload = commands.buildButtonCommand(command);
    this.send(MessageType.ButtonCommandRequest, payload);
    log(`Sent button press: key=${key}`);
  }

  /**
   * Send number command
   */
  async numberCommand(key: number, value: number): Promise<void> {
    const command: NumberCommand = { key, state: value };
    const payload = commands.buildNumberCommand(command);
    this.send(MessageType.NumberCommandRequest, payload);
    log(`Sent number command: key=${key} value=${value}`);
  }

  /**
   * Get entity by name
   */
  getEntityByName(name: string): AnyEntity | undefined {
    return Array.from(this.entities.values()).find((e) => e.name === name);
  }

  /**
   * Get entity by object ID
   */
  getEntityByObjectId(objectId: string): AnyEntity | undefined {
    return Array.from(this.entities.values()).find(
      (e) => e.objectId === objectId,
    );
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

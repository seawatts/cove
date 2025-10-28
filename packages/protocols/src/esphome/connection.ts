/**
 * ESPHome Native API Connection
 * Simplified to match the reference library structure
 */

import { EventEmitter } from 'node:events';
import { type Socket, connect as tcpConnect } from 'node:net';
import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { debug } from '@cove/logger';
import {
  AlarmControlPanelCommandRequestSchema,
  AuthenticationRequestSchema,
  ButtonCommandRequestSchema,
  CameraImageRequestSchema,
  ClimateCommandRequestSchema,
  CoverCommandRequestSchema,
  DateCommandRequestSchema,
  DateTimeCommandRequestSchema,
  DeviceInfoRequestSchema,
  FanCommandRequestSchema,
  HelloRequestSchema,
  LightCommandRequestSchema,
  ListEntitiesRequestSchema,
  LockCommandRequestSchema,
  MediaPlayerCommandRequestSchema,
  NumberCommandRequestSchema,
  PingRequestSchema,
  SelectCommandRequestSchema,
  SirenCommandRequestSchema,
  SubscribeBluetoothLEAdvertisementsRequestSchema,
  SubscribeLogsRequestSchema,
  SubscribeStatesRequestSchema,
  SwitchCommandRequestSchema,
  TextCommandRequestSchema,
  TimeCommandRequestSchema,
  UnsubscribeBluetoothLEAdvertisementsRequestSchema,
  ValveCommandRequestSchema,
} from './protoc/api_pb';
import {
  getIdBySchema,
  getMessageNameById,
  getSchemaById,
} from './utils/message-registry';

const log = debug('cove:esphome:connection');

export interface DeviceInfoResponse {
  usesPassword: boolean;
  name: string;
  macAddress: string;
  esphomeVersion: string;
  compilationTime: string;
  model: string;
  projectName: string;
  projectVersion: string;
}

export interface ESPHomeEntity {
  key: number;
  name: string;
  objectId: string;
  uniqueId: string;
  type: string;
  [key: string]: unknown;
}

export interface EntityState {
  key: number;
  missingState?: boolean;
  [key: string]: unknown;
}

export interface ConnectionOptions {
  host: string;
  port?: number;
  password?: string;
  clientInfo?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  pingInterval?: number;
}

export class ESPHomeConnection extends EventEmitter {
  private socket: Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private _connected = false;
  get connected(): boolean {
    return this._connected;
  }
  private pingTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private pingCount = 0;

  constructor(private options: ConnectionOptions) {
    super();
    this.options.port = options.port || 6053;
    this.options.clientInfo = options.clientInfo || 'Cove Hub';
    this.options.password = options.password || '';
    this.options.reconnect = options.reconnect !== false;
    this.options.reconnectInterval = options.reconnectInterval || 30000;
    this.options.pingInterval = options.pingInterval || 15000;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = tcpConnect(this.options.port ?? 6053, this.options.host);

      this.socket.on('connect', () => {
        log('TCP connected');
        this._connected = true;
        this.clearBuffer();
        this.startHandshake().then(resolve).catch(reject);
      });

      this.socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        log('Connection closed');
        this._connected = false;
        this.clearBuffer();
        this.clearTimers();

        if (this.options.reconnect) {
          this.reconnectTimer = setTimeout(
            () => this.connect(),
            this.options.reconnectInterval,
          );
          this.emit('reconnect');
        }
        this.emit('close');
      });

      this.socket.on('error', (error) => {
        log('Connection error:', error);
        this.emit('error', error);
        reject(error);
      });
    });
  }

  private async startHandshake(): Promise<void> {
    // Send Hello Request
    const helloRequest = create(HelloRequestSchema, {
      apiVersionMajor: 1,
      apiVersionMinor: 0,
      clientInfo: this.options.clientInfo ?? 'Cove Hub',
    });
    this.sendMessage(helloRequest, HelloRequestSchema);

    // Wait for Hello Response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Hello handshake timeout'));
      }, 5000);

      this.once('message.HelloResponse', () => {
        clearTimeout(timeout);
        this.sendConnectRequest().then(resolve).catch(reject);
      });
    });
  }

  private async sendConnectRequest(): Promise<void> {
    // Send Authentication Request
    const connectRequest = create(AuthenticationRequestSchema, {
      password: this.options.password ?? '',
    });
    this.sendMessage(connectRequest, AuthenticationRequestSchema);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 5000);

      this.once('message.AuthenticationResponse', (message) => {
        clearTimeout(timeout);
        if (message.invalidPassword) {
          reject(new Error('Invalid password'));
        } else {
          this.startPing();
          this.requestDeviceInfo();
          this.requestEntities();
          resolve();
        }
      });
    });
  }

  private requestDeviceInfo(): void {
    const deviceInfoRequest = create(DeviceInfoRequestSchema, {});
    this.sendMessage(deviceInfoRequest, DeviceInfoRequestSchema);
  }

  private requestEntities(): void {
    const listEntitiesRequest = create(ListEntitiesRequestSchema, {});
    this.sendMessage(listEntitiesRequest, ListEntitiesRequestSchema);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.pingCount >= 3) {
        log('Too many missed pings, reconnecting');
        this.disconnect();
        return;
      }
      this.pingCount++;
      const pingRequest = create(PingRequestSchema, {});
      this.sendMessage(pingRequest, PingRequestSchema);
    }, this.options.pingInterval);
  }

  private clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private clearBuffer(): void {
    this.buffer = Buffer.alloc(0);
  }

  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length >= 3) {
      const frame = this.parseFrame();
      if (!frame) break;
      this.handleMessage(frame.type, frame.data);
    }
  }

  private parseFrame(): { type: number; data: Buffer } | null {
    if (this.buffer.length < 3) return null;

    // Check for preamble (0x00)
    if (this.buffer[0] !== 0x00) {
      log('Invalid frame preamble');
      this.buffer = this.buffer.slice(1);
      return null;
    }

    // Parse length varint
    let offset = 1;
    let length = 0;
    let shift = 0;

    while (offset < this.buffer.length) {
      const byte = this.buffer[offset];
      if (byte === undefined) break;
      length |= (byte & 0x7f) << shift;
      offset++;

      if ((byte & 0x80) === 0) break;
      shift += 7;
    }

    // Parse type varint
    let type = 0;
    shift = 0;

    while (offset < this.buffer.length) {
      const byte = this.buffer[offset];
      if (byte === undefined) break;
      type |= (byte & 0x7f) << shift;
      offset++;

      if ((byte & 0x80) === 0) break;
      shift += 7;
    }

    // Check if we have enough data for the payload
    if (this.buffer.length < offset + length) return null;

    const data = this.buffer.slice(offset, offset + length);
    this.buffer = this.buffer.slice(offset + length);

    return { data, type };
  }

  private handleMessage(type: number, data: Buffer): void {
    const schema = getSchemaById(type);
    const typeName = getMessageNameById(type);

    if (!schema || !typeName) {
      log(`Unknown message type: ${type}`);
      return;
    }

    log(`Received message: ${typeName} (${data.length} bytes)`);

    try {
      // Parse the message using protobuf
      const message = fromBinary(
        schema as Parameters<typeof fromBinary>[0],
        new Uint8Array(data),
      );

      // Handle ping responses
      if (typeName === 'PingResponse') {
        this.pingCount = 0;
        return;
      }

      // Handle device info responses
      if (typeName === 'DeviceInfoResponse') {
        this.emit(
          `message.${typeName}`,
          message as unknown as DeviceInfoResponse,
        );
        this.emit('message', typeName, message);
        return;
      }

      // Handle entity messages with better error handling
      if (
        typeName.startsWith('ListEntities') &&
        typeName.endsWith('Response')
      ) {
        // Special case: ListEntitiesDoneResponse indicates completion
        if (typeName === 'ListEntitiesDoneResponse') {
          log('Entity discovery completed (Done message received)');
          this.emit('entitiesComplete');
          return;
        }

        // Emit the parsed message for client to handle
        this.emit(`message.${typeName}`, message);
        return;
      }

      // Handle state messages
      if (typeName.endsWith('StateResponse')) {
        this.handleStateMessage(typeName, message as unknown as EntityState);
        return;
      }

      // Emit the message
      this.emit(`message.${typeName}`, message);
      this.emit('message', typeName, message);
    } catch (error) {
      log(`Error parsing message ${typeName}:`, error);
      // For entity messages, try to continue processing other entities
      if (
        typeName.startsWith('ListEntities') &&
        typeName.endsWith('Response')
      ) {
        log(`Skipping problematic entity type: ${typeName}`);
        return;
      }
      // For state messages, also skip to avoid blocking
      if (typeName.endsWith('StateResponse')) {
        log(`Skipping problematic state message: ${typeName}`);
        return;
      }
      // Special case: ListEntitiesDoneResponse indicates entity discovery is complete
      if (typeName === 'ListEntitiesDoneResponse') {
        log('Entity discovery completed (Done message received)');
        this.emit('entitiesComplete');
        return;
      }
    }
  }

  private handleStateMessage(_typeName: string, message: EntityState): void {
    // Emit state message for client to handle
    this.emit(`message.${_typeName}`, message);
  }

  public sendMessage(message: unknown, schema: unknown): void {
    if (!this.socket || !this._connected) {
      throw new Error('Not connected');
    }

    if (!schema) {
      throw new Error('Schema is required for message serialization');
    }

    // Get message ID from registry
    const messageId = getIdBySchema(
      schema as Parameters<typeof getIdBySchema>[0],
    );
    if (!messageId) {
      throw new Error(
        `Unknown schema: ${(schema as { typeName?: string }).typeName || 'unknown'}`,
      );
    }

    // Serialize the message using the schema
    const payload = toBinary(
      schema as Parameters<typeof toBinary>[0],
      message as Parameters<typeof toBinary>[1],
    );

    const frame = this.frameMessage(messageId, payload);
    this.socket.write(frame);
    log(
      `Sent message: ${(schema as { typeName?: string }).typeName} (${payload.length} bytes)`,
    );
  }

  private frameMessage(type: number, payload: Uint8Array): Buffer {
    const typeVarint = this.encodeVarint(type);
    const lengthVarint = this.encodeVarint(payload.length);

    return Buffer.concat([
      Buffer.from([0x00]), // Preamble
      lengthVarint,
      typeVarint,
      Buffer.from(payload),
    ]);
  }

  private encodeVarint(value: number): Buffer {
    const bytes: number[] = [];
    let n = value;

    while (n >= 0x80) {
      bytes.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    bytes.push(n & 0x7f);

    return Buffer.from(bytes);
  }

  disconnect(): void {
    this.clearTimers();
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
    this._connected = false;
  }

  // Command methods
  async lightCommand(key: number, command: unknown): Promise<void> {
    const commandObj = command as Record<string, unknown>;
    const lightCommandRequest = create(LightCommandRequestSchema, {
      blue: commandObj.blue as number | undefined,
      brightness: commandObj.brightness as number | undefined,
      green: commandObj.green as number | undefined,
      key,
      red: commandObj.red as number | undefined,
      state: commandObj.state as boolean | undefined,
    });

    this.sendMessage(lightCommandRequest, LightCommandRequestSchema);
  }

  async switchCommand(key: number, state: boolean): Promise<void> {
    const switchCommandRequest = create(SwitchCommandRequestSchema, {
      key,
      state,
    });
    this.sendMessage(switchCommandRequest, SwitchCommandRequestSchema);
  }

  async numberCommand(key: number, state: number): Promise<void> {
    const numberCommandRequest = create(NumberCommandRequestSchema, {
      key,
      state,
    });
    this.sendMessage(numberCommandRequest, NumberCommandRequestSchema);
  }

  async buttonCommand(key: number): Promise<void> {
    const buttonCommandRequest = create(ButtonCommandRequestSchema, {
      key,
    });
    this.sendMessage(buttonCommandRequest, ButtonCommandRequestSchema);
  }

  async alarmControlPanelCommand(key: number, command: unknown): Promise<void> {
    const alarmControlPanelCommandRequest = create(
      AlarmControlPanelCommandRequestSchema,
      {
        command: command as number,
        key,
      },
    );
    this.sendMessage(
      alarmControlPanelCommandRequest,
      AlarmControlPanelCommandRequestSchema,
    );
  }

  async climateCommand(key: number, command: unknown): Promise<void> {
    const commandObj = command as Record<string, unknown>;
    const climateCommandRequest = create(ClimateCommandRequestSchema, {
      customFanMode: commandObj.customFanMode as string | undefined,
      customPreset: commandObj.customPreset as string | undefined,
      fanMode: commandObj.fanMode as number | undefined,
      hasCustomFanMode: commandObj.customFanMode !== undefined,
      hasCustomPreset: commandObj.customPreset !== undefined,
      hasFanMode: commandObj.fanMode !== undefined,
      hasMode: commandObj.mode !== undefined,
      hasPreset: commandObj.preset !== undefined,
      hasSwingMode: commandObj.swingMode !== undefined,
      hasTargetTemperature: commandObj.targetTemperature !== undefined,
      hasTargetTemperatureHigh: commandObj.targetTemperatureHigh !== undefined,
      hasTargetTemperatureLow: commandObj.targetTemperatureLow !== undefined,
      key,
      mode: commandObj.mode as number | undefined,
      preset: commandObj.preset as number | undefined,
      swingMode: commandObj.swingMode as number | undefined,
      targetTemperature: commandObj.targetTemperature as number | undefined,
      targetTemperatureHigh: commandObj.targetTemperatureHigh as
        | number
        | undefined,
      targetTemperatureLow: commandObj.targetTemperatureLow as
        | number
        | undefined,
    });
    this.sendMessage(climateCommandRequest, ClimateCommandRequestSchema);
  }

  async coverCommand(key: number, command: unknown): Promise<void> {
    const commandObj = command as Record<string, unknown>;
    const coverCommandRequest = create(CoverCommandRequestSchema, {
      key,
      legacyCommand: commandObj.legacyCommand as number | undefined,
      position: commandObj.position as number | undefined,
      stop: commandObj.stop as boolean | undefined,
      tilt: commandObj.tilt as number | undefined,
    });
    this.sendMessage(coverCommandRequest, CoverCommandRequestSchema);
  }

  async dateCommand(key: number, state: string): Promise<void> {
    // Parse YYYY-MM-DD format
    const [year, month, day] = state.split('-').map(Number);
    const dateCommandRequest = create(DateCommandRequestSchema, {
      day,
      key,
      month,
      year,
    });
    this.sendMessage(dateCommandRequest, DateCommandRequestSchema);
  }

  async dateTimeCommand(key: number, state: string): Promise<void> {
    // Parse YYYY-MM-DDTHH:MM:SS format and convert to epoch seconds
    const parts = state.split('T');
    if (parts.length !== 2) {
      throw new Error(
        `Invalid datetime format: ${state}. Expected YYYY-MM-DDTHH:MM:SS`,
      );
    }
    const dateParts = parts[0]?.split('-');
    const timeParts = parts[1]?.split(':');
    if (
      !dateParts ||
      dateParts.length !== 3 ||
      !timeParts ||
      timeParts.length !== 3
    ) {
      throw new Error(
        `Invalid datetime format: ${state}. Expected YYYY-MM-DDTHH:MM:SS`,
      );
    }
    const [year, month, day] = dateParts.map(Number);
    const [hour, minute, second] = timeParts.map(Number);
    if (
      year === undefined ||
      month === undefined ||
      day === undefined ||
      hour === undefined ||
      minute === undefined ||
      second === undefined
    ) {
      throw new Error(
        `Invalid datetime format: ${state}. Expected YYYY-MM-DDTHH:MM:SS`,
      );
    }
    const date = new Date(year, month - 1, day, hour, minute, second);
    const epochSeconds = Math.floor(date.getTime() / 1000);

    const dateTimeCommandRequest = create(DateTimeCommandRequestSchema, {
      epochSeconds,
      key,
    });
    this.sendMessage(dateTimeCommandRequest, DateTimeCommandRequestSchema);
  }

  async fanCommand(key: number, command: unknown): Promise<void> {
    const commandObj = command as Record<string, unknown>;
    const fanCommandRequest = create(FanCommandRequestSchema, {
      direction: commandObj.direction as number | undefined,
      key,
      oscillating: commandObj.oscillating as boolean | undefined,
      speed: commandObj.speed as number | undefined,
      speedLevel: commandObj.speedLevel as number | undefined,
      state: commandObj.state as boolean | undefined,
    });
    this.sendMessage(fanCommandRequest, FanCommandRequestSchema);
  }

  async lockCommand(
    key: number,
    command: unknown,
    code?: string,
  ): Promise<void> {
    const lockCommandRequest = create(LockCommandRequestSchema, {
      code,
      command: command as number,
      key,
    });
    this.sendMessage(lockCommandRequest, LockCommandRequestSchema);
  }

  async mediaPlayerCommand(key: number, command: unknown): Promise<void> {
    const commandObj = command as Record<string, unknown>;
    const mediaPlayerCommandRequest = create(MediaPlayerCommandRequestSchema, {
      command: commandObj.command as number | undefined,
      key,
      mediaUrl: commandObj.mediaUrl as string | undefined,
      volume: commandObj.volume as number | undefined,
    });
    this.sendMessage(
      mediaPlayerCommandRequest,
      MediaPlayerCommandRequestSchema,
    );
  }

  async selectCommand(key: number, state: string): Promise<void> {
    const selectCommandRequest = create(SelectCommandRequestSchema, {
      key,
      state,
    });
    this.sendMessage(selectCommandRequest, SelectCommandRequestSchema);
  }

  async sirenCommand(key: number, command: unknown): Promise<void> {
    const commandObj = command as Record<string, unknown>;
    const sirenCommandRequest = create(SirenCommandRequestSchema, {
      duration: commandObj.duration as number | undefined,
      key,
      state: commandObj.state as boolean | undefined,
      tone: commandObj.tone as string | undefined,
      volume: commandObj.volume as number | undefined,
    });
    this.sendMessage(sirenCommandRequest, SirenCommandRequestSchema);
  }

  async textCommand(key: number, state: string): Promise<void> {
    const textCommandRequest = create(TextCommandRequestSchema, {
      key,
      state,
    });
    this.sendMessage(textCommandRequest, TextCommandRequestSchema);
  }

  async timeCommand(key: number, state: string): Promise<void> {
    // Parse HH:MM:SS format
    const [hour, minute, second] = state.split(':').map(Number);
    const timeCommandRequest = create(TimeCommandRequestSchema, {
      hour,
      key,
      minute,
      second,
    });
    this.sendMessage(timeCommandRequest, TimeCommandRequestSchema);
  }

  async valveCommand(
    key: number,
    _operation: unknown,
    position?: number,
  ): Promise<void> {
    const valveCommandRequest = create(ValveCommandRequestSchema, {
      hasPosition: position !== undefined,
      key,
      position,
    });
    this.sendMessage(valveCommandRequest, ValveCommandRequestSchema);
  }

  async cameraImageRequest(_key: number): Promise<void> {
    const cameraImageRequest = create(CameraImageRequestSchema, {
      single: true,
      stream: false,
    });
    this.sendMessage(cameraImageRequest, CameraImageRequestSchema);
  }

  // Service methods that the client expects
  async deviceInfoService(): Promise<DeviceInfoResponse> {
    const deviceInfoRequest = create(DeviceInfoRequestSchema, {});
    this.sendMessage(deviceInfoRequest, DeviceInfoRequestSchema);
    return new Promise((resolve) => {
      this.once('message.DeviceInfoResponse', resolve);
    });
  }

  async listEntitiesService(): Promise<ESPHomeEntity[]> {
    const listEntitiesRequest = create(ListEntitiesRequestSchema, {});
    this.sendMessage(listEntitiesRequest, ListEntitiesRequestSchema);
    return new Promise((resolve) => {
      const entities: ESPHomeEntity[] = [];
      const handler = (message: ESPHomeEntity) => {
        entities.push(message);
      };
      this.on('message', handler);
      this.once('message.ListEntitiesDoneResponse', () => {
        this.off('message', handler);
        resolve(entities);
      });
    });
  }

  subscribeStatesService(): void {
    const subscribeStatesRequest = create(SubscribeStatesRequestSchema, {});
    this.sendMessage(subscribeStatesRequest, SubscribeStatesRequestSchema);
  }

  subscribeLogsService(level = 0, dumpConfig = false): void {
    const subscribeLogsRequest = create(SubscribeLogsRequestSchema, {
      dumpConfig,
      level,
    });
    this.sendMessage(subscribeLogsRequest, SubscribeLogsRequestSchema);
  }

  subscribeBluetoothAdvertisementService(): void {
    const subscribeBLERequest = create(
      SubscribeBluetoothLEAdvertisementsRequestSchema,
      {},
    );
    this.sendMessage(
      subscribeBLERequest,
      SubscribeBluetoothLEAdvertisementsRequestSchema,
    );
  }

  unsubscribeBluetoothAdvertisementService(): void {
    const unsubscribeBLERequest = create(
      UnsubscribeBluetoothLEAdvertisementsRequestSchema,
      {},
    );
    this.sendMessage(
      unsubscribeBLERequest,
      UnsubscribeBluetoothLEAdvertisementsRequestSchema,
    );
  }
}

import type { ESPHomeConnection } from '../connection';
import type { ColorMode } from '../protoc/api_pb';
import {
  LightCommandRequestSchema,
  LightStateResponseSchema,
  ListEntitiesLightResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface LightConfig extends EntityConfig {
  supportedColorModes: ColorMode[];
  legacySupportsBrightness: boolean;
  legacySupportsRgb: boolean;
  legacySupportsWhiteValue: boolean;
  legacySupportsColorTemperature: boolean;
  minMireds: number;
  maxMireds: number;
  effects: string[];
  disabledByDefault: boolean;
  icon: string;
  entityCategory: number;
  deviceId: number;
}

export interface LightState extends EntityState {
  state: boolean;
  brightness: number;
  colorMode: ColorMode;
  colorBrightness: number;
  red: number;
  green: number;
  blue: number;
  white: number;
  colorTemperature: number;
  coldWhite: number;
  warmWhite: number;
  effect: string;
}

export interface LightCommand {
  state?: boolean;
  brightness?: number;
  colorMode?: ColorMode;
  colorBrightness?: number;
  red?: number;
  green?: number;
  blue?: number;
  white?: number;
  colorTemperature?: number;
  coldWhite?: number;
  warmWhite?: number;
  transitionLength?: number;
  flashLength?: number;
  effect?: string;
}

export class LightEntity extends BaseEntity<LightConfig, LightState> {
  public config: LightConfig;
  public state?: LightState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: LightConfig;
    state?: LightState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'LightStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesLightResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesLightResponseSchema;
  }

  protected getStateSchema() {
    return LightStateResponseSchema;
  }

  protected getCommandSchema() {
    return LightCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): LightConfig {
    return protoMessage as LightConfig;
  }

  public parseState(protoMessage: unknown): LightState {
    return protoMessage as LightState;
  }

  protected createCommand(commandData: LightCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setState(state: boolean): Promise<void> {
    await this.command({ state });
  }

  async setBrightness(brightness: number): Promise<void> {
    if (!this.config.legacySupportsBrightness) {
      throw new Error('brightness is not supported');
    }
    // Convert 0-255 range to 0.0-1.0 range
    const normalizedBrightness = Math.max(0, Math.min(1, brightness / 255));
    await this.command({ brightness: normalizedBrightness });
  }

  async setRgb(red: number, green: number, blue: number): Promise<void> {
    if (!this.config.legacySupportsRgb) {
      throw new Error('rgb is not supported');
    }
    // Convert 0-255 range to 0.0-1.0 range
    const normalizedRed = Math.max(0, Math.min(1, red / 255));
    const normalizedGreen = Math.max(0, Math.min(1, green / 255));
    const normalizedBlue = Math.max(0, Math.min(1, blue / 255));
    await this.command({
      blue: normalizedBlue,
      green: normalizedGreen,
      red: normalizedRed,
    });
  }

  async setColorMode(colorMode: ColorMode): Promise<void> {
    if (!this.config.supportedColorModes) {
      throw new Error('color modes are not supported');
    }
    if (!this.config.supportedColorModes.includes(colorMode)) {
      throw new Error(`color mode(${colorMode}) is not supported`);
    }
    await this.command({ colorMode });
  }

  async setColorBrightness(colorBrightness: number): Promise<void> {
    await this.command({ colorBrightness });
  }

  async setWhite(white: number): Promise<void> {
    if (!this.config.legacySupportsWhiteValue) {
      throw new Error('white_value is not supported');
    }
    await this.command({ white });
  }

  async setColorTemperature(colorTemperature: number): Promise<void> {
    if (!this.config.legacySupportsColorTemperature) {
      throw new Error('color_temperature is not supported');
    }
    await this.command({ colorTemperature });
  }

  async setColdWhite(coldWhite: number): Promise<void> {
    await this.command({ coldWhite });
  }

  async setWarmWhite(warmWhite: number): Promise<void> {
    await this.command({ warmWhite });
  }

  async setTransitionLength(transitionLength: number): Promise<void> {
    await this.command({ transitionLength });
  }

  async setFlashLength(flashLength: number): Promise<void> {
    await this.command({ flashLength });
  }

  async setEffect(effect: string): Promise<void> {
    if (!this.config.effects) {
      throw new Error('effects are not supported');
    }
    if (!this.config.effects.includes(effect)) {
      throw new Error(`effect(${effect}) is not supported`);
    }
    await this.command({ effect });
  }

  private async command(params: LightCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's lightCommand method
    await this.connection.lightCommand(this.config.key, params);
  }
}

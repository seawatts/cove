import type { ESPHomeConnection } from '../connection';
import type {
  ClimateFanMode,
  ClimateMode,
  ClimatePreset,
  ClimateSwingMode,
} from '../protoc/api_pb';
import {
  ClimateCommandRequestSchema,
  ClimateStateResponseSchema,
  ListEntitiesClimateResponseSchema,
} from '../protoc/api_pb';
import { BaseEntity, type EntityConfig, type EntityState } from './base';

export interface ClimateConfig extends EntityConfig {
  supportsCurrentTemperature: boolean;
  supportsTwoPointTargetTemperature: boolean;
  supportedModes: ClimateMode[];
  visualMinTemperature: number;
  visualMaxTemperature: number;
  visualTargetTemperatureStep: number;
  legacySupportsAway: boolean;
  supportsAction: boolean;
  supportedFanModes: ClimateFanMode[];
  supportedSwingModes: ClimateSwingMode[];
  supportedCustomFanModes: string[];
  supportedPresets: ClimatePreset[];
  supportedCustomPresets: string[];
  disabledByDefault: boolean;
  icon: string;
  entityCategory: number;
  visualCurrentTemperatureStep: number;
}

export interface ClimateState extends EntityState {
  hasMode: boolean;
  mode: ClimateMode;
  hasTargetTemperature: boolean;
  targetTemperature: number;
  hasTargetTemperatureLow: boolean;
  targetTemperatureLow: number;
  hasTargetTemperatureHigh: boolean;
  targetTemperatureHigh: number;
  hasLegacyAway: boolean;
  legacyAway: boolean;
  hasFanMode: boolean;
  fanMode: ClimateFanMode;
  hasSwingMode: boolean;
  swingMode: ClimateSwingMode;
  hasCustomFanMode: boolean;
  customFanMode: string;
  hasPreset: boolean;
  preset: ClimatePreset;
  hasCustomPreset: boolean;
  customPreset: string;
}

export interface ClimateCommand {
  mode?: ClimateMode;
  targetTemperature?: number;
  targetTemperatureLow?: number;
  targetTemperatureHigh?: number;
  legacyAway?: boolean;
  fanMode?: ClimateFanMode;
  swingMode?: ClimateSwingMode;
  customFanMode?: string;
  preset?: ClimatePreset;
  customPreset?: string;
}

export class ClimateEntity extends BaseEntity<ClimateConfig, ClimateState> {
  public config: ClimateConfig;
  public state?: ClimateState;

  constructor({
    connection,
    config,
    state,
  }: {
    connection?: ESPHomeConnection;
    config: ClimateConfig;
    state?: ClimateState;
  }) {
    super({ config, connection, state });
    this.config = config;
    this.state = state;
  }

  static getStateResponseName(): string {
    return 'ClimateStateResponse';
  }

  static getListEntitiesResponseName(): string {
    return 'ListEntitiesClimateResponse';
  }

  // Protobuf schema methods
  protected getConfigSchema() {
    return ListEntitiesClimateResponseSchema;
  }

  protected getStateSchema() {
    return ClimateStateResponseSchema;
  }

  protected getCommandSchema() {
    return ClimateCommandRequestSchema;
  }

  // Type-safe parsing methods
  public parseConfig(protoMessage: unknown): ClimateConfig {
    return protoMessage as ClimateConfig;
  }

  public parseState(protoMessage: unknown): ClimateState {
    return protoMessage as ClimateState;
  }

  protected createCommand(commandData: ClimateCommand): unknown {
    return {
      key: this.config.key,
      ...commandData,
    };
  }

  // Command methods
  async setTargetTemperature(targetTemperature: number): Promise<void> {
    await this.command({ targetTemperature });
  }

  async setTargetTemperatureLow(targetTemperatureLow: number): Promise<void> {
    if (!this.config.supportsTwoPointTargetTemperature) {
      throw new Error('two_point_target_temperature is not supported');
    }
    await this.command({ targetTemperatureLow });
  }

  async setTargetTemperatureHigh(targetTemperatureHigh: number): Promise<void> {
    if (!this.config.supportsTwoPointTargetTemperature) {
      throw new Error('two_point_target_temperature is not supported');
    }
    await this.command({ targetTemperatureHigh });
  }

  async setMode(mode: ClimateMode): Promise<void> {
    if (!this.config.supportedModes) {
      throw new Error('modes are not supported');
    }
    if (!this.config.supportedModes.includes(mode)) {
      throw new Error(`mode(${mode}) is not supported`);
    }
    await this.command({ mode });
  }

  async setLegacyAway(legacyAway: boolean): Promise<void> {
    if (!this.config.legacySupportsAway) {
      throw new Error('legacy away is not supported');
    }
    await this.command({ legacyAway });
  }

  async setFanMode(fanMode: ClimateFanMode): Promise<void> {
    if (!this.config.supportedFanModes) {
      throw new Error('fan modes are not supported');
    }
    if (!this.config.supportedFanModes.includes(fanMode)) {
      throw new Error(`fan mode(${fanMode}) is not supported`);
    }
    await this.command({ fanMode });
  }

  async setSwingMode(swingMode: ClimateSwingMode): Promise<void> {
    if (!this.config.supportedSwingModes) {
      throw new Error('swing modes are not supported');
    }
    if (!this.config.supportedSwingModes.includes(swingMode)) {
      throw new Error(`swing mode(${swingMode}) is not supported`);
    }
    await this.command({ swingMode });
  }

  async setCustomFanMode(customFanMode: string): Promise<void> {
    if (!this.config.supportedCustomFanModes) {
      throw new Error('custom fan modes are not supported');
    }
    if (!this.config.supportedCustomFanModes.includes(customFanMode)) {
      throw new Error(`custom fan mode(${customFanMode}) is not supported`);
    }
    await this.command({ customFanMode });
  }

  async setPreset(preset: ClimatePreset): Promise<void> {
    if (!this.config.supportedPresets) {
      throw new Error('presets are not supported');
    }
    if (!this.config.supportedPresets.includes(preset)) {
      throw new Error(`preset(${preset}) is not supported`);
    }
    await this.command({ preset });
  }

  async setCustomPreset(customPreset: string): Promise<void> {
    if (!this.config.supportedCustomPresets) {
      throw new Error('custom presets are not supported');
    }
    if (!this.config.supportedCustomPresets.includes(customPreset)) {
      throw new Error(`custom preset(${customPreset}) is not supported`);
    }
    await this.command({ customPreset });
  }

  private async command(params: ClimateCommand): Promise<void> {
    if (!this.connection) {
      throw new Error('connection is not attached');
    }

    // Use the client's climateCommand method
    await this.connection.climateCommand(this.config.key, params);
  }
}

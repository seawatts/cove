// Core types for device state and events
type DeviceId = string;
type PropertyValue =
  | null
  | undefined
  | boolean
  | number
  | string
  | Record<string, unknown>;
type Timestamp = number;

// Capability-driven state types
interface PowerControlState {
  power: boolean;
}

interface BrightnessControlState {
  brightness: number;
}

interface ColorControlState {
  color: {
    hue: number;
    saturation: number;
    value: number;
  };
}

interface MotionSensingState {
  presence: boolean;
}

interface TemperatureSensingState {
  temperature: number;
  temperatureUnit: 'C' | 'F';
}

interface ButtonControlState {
  buttonEvent: number | null;
}

// Device Capabilities (Traits)
interface DeviceCapability<
  T extends Record<string, PropertyValue | null | undefined>,
> {
  readonly type: string;
  stateType: T; // This is just for type inference, not used at runtime
}

interface PowerControl extends DeviceCapability<PowerControlState> {
  type: 'power-control';
}

interface BrightnessControl extends DeviceCapability<BrightnessControlState> {
  type: 'brightness-control';
}

interface ColorControl extends DeviceCapability<ColorControlState> {
  type: 'color-control';
}

interface MotionSensing extends DeviceCapability<MotionSensingState> {
  type: 'motion-sensing';
  onMotionDetected(callback: () => void): () => void;
}

interface TemperatureSensing extends DeviceCapability<TemperatureSensingState> {
  type: 'temperature-sensing';
}

interface ButtonControl extends DeviceCapability<ButtonControlState> {
  type: 'button-control';
  onButtonPressed(callback: (buttonId: number) => void): () => void;
}

// Helper type to extract state type from capability
type CapabilityState<T extends DeviceCapability<any>> =
  T extends DeviceCapability<infer S> ? S : never;

// Helper type to merge all capability states
type MergeCapabilityStates<T extends DeviceCapability<any>[]> =
  UnionToIntersection<CapabilityState<T[number]>>;

// Helper type to convert union to intersection
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

// Device Shadow State Management
interface DeviceShadow<T extends MergeCapabilityStates<any[]>> {
  reported: T;
  desired: T;
  metadata: {
    reported: { [key: string]: { timestamp: Timestamp } };
    desired: { [key: string]: { timestamp: Timestamp } };
  };
  version: number;
  timestamp: Timestamp;
  disconnectedAt?: Timestamp;
}

interface DeviceState {
  [property: string]: PropertyValue;
}

interface DeviceEvent {
  deviceId: DeviceId;
  type: string;
  data: Record<string, unknown>;
  timestamp: Timestamp;
}

// Protocol and Communication
interface DeviceProtocol {
  // Core protocol methods
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // State management
  getState(): Promise<DeviceState>;
  setState(properties: Partial<DeviceState>): Promise<void>;

  // Event handling
  onStateChange(callback: (state: Partial<DeviceState>) => void): void;
  onEvent(callback: (event: DeviceEvent) => void): void;
  onConnectionChange(callback: (connected: boolean) => void): void;
}

// Core Device class with typed state based on capabilities
abstract class Device<
  TCapabilities extends DeviceCapability<any>[] = DeviceCapability<any>[],
> {
  private shadow: DeviceShadow<MergeCapabilityStates<TCapabilities>>;
  private capabilities = new Set<DeviceCapability<any>>();
  private eventHandlers = new Set<(event: DeviceEvent) => void>();
  private stateUpdateQueue: Array<() => Promise<void>> = [];
  private processingQueue = false;

  constructor(
    public readonly id: DeviceId,
    public readonly name: string,
    protected protocol: DeviceProtocol,
  ) {
    this.shadow = {
      reported: {} as MergeCapabilityStates<TCapabilities>,
      desired: {} as MergeCapabilityStates<TCapabilities>,
      metadata: {
        reported: {},
        desired: {},
      },
      version: 0,
      timestamp: Date.now(),
    };

    protocol.onStateChange((newState) => {
      this.updateReportedState(newState);
    });

    protocol.onConnectionChange((connected) => {
      if (!connected) {
        this.shadow.disconnectedAt = Date.now();
      } else if (this.shadow.disconnectedAt) {
        this.shadow.disconnectedAt = undefined;
        this.syncWithDesiredState();
      }
    });

    protocol.onEvent((event) => {
      for (const handler of this.eventHandlers) {
        handler(event);
      }
    });
  }

  abstract toProtocolState(
    state: Partial<MergeCapabilityStates<TCapabilities>>,
  ): Record<string, unknown>;
  abstract fromProtocolState(
    state: Record<string, unknown>,
  ): Partial<MergeCapabilityStates<TCapabilities>>;

  async initialize(): Promise<void> {
    await this.protocol.connect();
    const currentState = await this.protocol.getState();
    this.updateReportedState(currentState);
  }

  private async updateReportedState(newState: Partial<DeviceState>): void {
    const timestamp = Date.now();

    // Update reported state and metadata
    this.shadow.reported = { ...this.shadow.reported, ...newState };
    for (const [key] of Object.entries(newState)) {
      this.shadow.metadata.reported[key] = { timestamp };
    }

    this.shadow.version += 1;
    this.shadow.timestamp = timestamp;
  }

  private async updateDesiredState(
    newState: Partial<DeviceState>,
  ): Promise<void> {
    const timestamp = Date.now();

    // Update desired state and metadata
    this.shadow.desired = { ...this.shadow.desired, ...newState };
    for (const [key] of Object.entries(newState)) {
      this.shadow.metadata.desired[key] = { timestamp };
    }

    this.shadow.version += 1;
    this.shadow.timestamp = timestamp;

    // Queue the state update
    this.queueStateUpdate(() => this.protocol.setState(newState));
  }

  private async queueStateUpdate(update: () => Promise<void>): Promise<void> {
    this.stateUpdateQueue.push(update);
    if (!this.processingQueue) {
      await this.processStateUpdateQueue();
    }
  }

  private async processStateUpdateQueue(): Promise<void> {
    if (this.processingQueue) return;

    this.processingQueue = true;
    while (this.stateUpdateQueue.length > 0) {
      const update = this.stateUpdateQueue.shift();
      if (update) {
        try {
          await update();
        } catch (error) {
          console.error('Failed to process state update:', error);
        }
      }
    }
    this.processingQueue = false;
  }

  private async syncWithDesiredState(): Promise<void> {
    const diff: Partial<DeviceState> = {};

    for (const [key, value] of Object.entries(this.shadow.desired)) {
      if (this.shadow.reported[key] !== value) {
        diff[key] = value;
      }
    }

    if (Object.keys(diff).length > 0) {
      await this.protocol.setState(diff);
    }
  }

  async setState(
    properties: Partial<MergeCapabilityStates<TCapabilities>>,
  ): Promise<void> {
    await this.updateDesiredState(properties);
  }

  getState(): MergeCapabilityStates<TCapabilities> {
    return { ...this.shadow.reported };
  }

  getDesiredState(): MergeCapabilityStates<TCapabilities> {
    return { ...this.shadow.desired };
  }

  getShadow(): DeviceShadow<MergeCapabilityStates<any[]>> {
    return { ...this.shadow };
  }

  hasCapability<T extends DeviceCapability<any>>(type: string): boolean {
    return this.capabilities.has(type);
  }

  getCapability<T extends DeviceCapability<any>>(type: string): T | undefined {
    return this.capabilities.get(type) as T | undefined;
  }

  onEvent(handler: (event: DeviceEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  isConnected(): boolean {
    return this.protocol.isConnected();
  }

  protected addCapability(capability: DeviceCapability<any>): void {
    this.capabilities.add(capability);
  }
}

// Hue Protocol Types
interface HueDeviceBase extends Device {
  type: string;
  modelid: string;
  manufacturername: string;
  uniqueid: string;
  swversion: string;
}

// Concrete device implementations
class HueLightDevice
  extends Device<[PowerControl, BrightnessControl, ColorControl]>
  implements PowerControl, BrightnessControl, ColorControl
{
  readonly type = 'hue-light';

  constructor(
    id: DeviceId,
    name: string,
    protocol: DeviceProtocol,
    private deviceType:
      | 'Extended color light'
      | 'Color light'
      | 'Dimmable light' = 'Extended color light',
  ) {
    super(id, name, protocol);

    // Add capabilities based on device type
    this.addCapability({ type: 'power-control' } as PowerControl);
    this.addCapability({ type: 'brightness-control' } as BrightnessControl);

    if (deviceType === 'Extended color light' || deviceType === 'Color light') {
      this.addCapability({ type: 'color-control' } as ColorControl);
    }
  }

  // PowerControl implementation
  async turnOn(): Promise<void> {
    await this.setState({ power: true });
  }

  async turnOff(): Promise<void> {
    await this.setState({ power: false });
  }

  isPowered(): boolean {
    return this.getState().power as boolean;
  }

  // BrightnessControl implementation
  async setBrightness(level: number): Promise<void> {
    await this.setState({ brightness: Math.max(0, Math.min(100, level)) });
  }

  getBrightness(): number {
    return (this.getState().brightness as number) || 0;
  }

  // ColorControl implementation
  async setColor(color: {
    hue: number;
    saturation: number;
    value: number;
  }): Promise<void> {
    if (this.deviceType !== 'Extended color light') {
      throw new Error('Color control not supported by this device type');
    }
    await this.setState({ color });
  }

  getColor(): { hue: number; saturation: number; value: number } | null {
    if (this.deviceType !== 'Extended color light') {
      return null;
    }
    return (
      (this.getState().color as {
        hue: number;
        saturation: number;
        value: number;
      }) || null
    );
  }

  toProtocolState(
    state: Partial<
      PowerControlState & BrightnessControlState & ColorControlState
    >,
  ): Record<string, unknown> {
    const hueState: Record<string, unknown> = {};

    if ('power' in state) {
      hueState.on = state.power;
    }

    if ('brightness' in state) {
      hueState.bri = Math.round((state.brightness / 100) * 254);
    }

    if ('color' in state && this.deviceType === 'Extended color light') {
      const color = state.color;
      hueState.hue = Math.round((color.hue / 360) * 65535);
      hueState.sat = Math.round((color.saturation / 100) * 254);
    }

    return hueState;
  }

  fromProtocolState(
    protocolState: Record<string, unknown>,
  ): Partial<PowerControlState & BrightnessControlState & ColorControlState> {
    const state: Partial<
      PowerControlState & BrightnessControlState & ColorControlState
    > = {
      power: protocolState.on as boolean,
    };

    if ('bri' in protocolState) {
      state.brightness = Math.round(
        ((protocolState.bri as number) / 254) * 100,
      );
    }

    if (
      this.deviceType === 'Extended color light' &&
      'colormode' in protocolState &&
      protocolState.colormode === 'hs' &&
      'hue' in protocolState &&
      'sat' in protocolState
    ) {
      state.color = {
        hue: Math.round(((protocolState.hue as number) / 65535) * 360),
        saturation: Math.round(((protocolState.sat as number) / 254) * 100),
        value: state.brightness || 100,
      };
    }

    return state;
  }
}

class HueMotionSensorDevice
  extends Device<[MotionSensing, TemperatureSensing]>
  implements MotionSensing, TemperatureSensing
{
  private motionCallbacks = new Set<() => void>();

  constructor(id: DeviceId, name: string, protocol: DeviceProtocol) {
    super(id, name, protocol);
    this.addCapability({ type: 'motion-sensing' } as MotionSensing);
    this.addCapability({ type: 'temperature-sensing' } as TemperatureSensing);

    // Set up motion detection events
    this.onEvent((event) => {
      if (event.type === 'stateChange') {
        const state = this.getState();
        if (state.presence && this.motionCallbacks.size > 0) {
          this.motionCallbacks.forEach((callback) => callback());
        }
      }
    });
  }

  // MotionSensing implementation
  isMotionDetected(): boolean {
    return this.getState().presence as boolean;
  }

  onMotionDetected(callback: () => void): () => void {
    this.motionCallbacks.add(callback);
    return () => this.motionCallbacks.delete(callback);
  }

  // TemperatureSensing implementation
  getTemperature(): number {
    return this.getState().temperature as number;
  }

  getTemperatureUnit(): 'C' | 'F' {
    return 'C'; // Hue sensors always report in Celsius
  }

  toProtocolState(
    state: Partial<MotionSensingState & TemperatureSensingState>,
  ): Record<string, unknown> {
    // Motion sensors are mostly read-only, but we can control some config
    const protocolState: Record<string, unknown> = {};

    if ('enabled' in state) {
      protocolState.config = { on: state.enabled };
    }

    return protocolState;
  }

  fromProtocolState(
    protocolState: Record<string, unknown>,
  ): Partial<MotionSensingState & TemperatureSensingState> {
    const state = protocolState as {
      presence?: boolean;
      temperature?: number;
      lightlevel?: number;
      battery?: number;
      lastupdated?: string;
      config?: { reachable?: boolean };
    };

    return {
      presence: state.presence || false,
      temperature: state.temperature ? state.temperature / 100 : 0, // Convert to Celsius
      lightLevel: state.lightlevel || 0,
      battery: state.battery || 0,
      lastUpdated: state.lastupdated || new Date().toISOString(),
      reachable: state.config?.reachable ?? true,
    };
  }
}

class HueTemperatureSensorDevice extends Device<[TemperatureSensing]> {
  toProtocolState(
    state: Partial<TemperatureSensingState>,
  ): Record<string, unknown> {
    const protocolState: Record<string, unknown> = {};

    if ('enabled' in state) {
      protocolState.config = { on: state.enabled };
    }

    return protocolState;
  }

  fromProtocolState(
    protocolState: Record<string, unknown>,
  ): Partial<TemperatureSensingState> {
    const state = protocolState as {
      temperature?: number;
      battery?: number;
      lastupdated?: string;
      config?: { reachable?: boolean };
    };

    return {
      temperature: state.temperature ? state.temperature / 100 : 0,
      battery: state.battery || 0,
      lastUpdated: state.lastupdated || new Date().toISOString(),
      reachable: state.config?.reachable ?? true,
    };
  }
}

class HueDimmerSwitchDevice extends Device<[PowerControl, ButtonControl]> {
  toProtocolState(
    state: Partial<PowerControlState & ButtonControlState>,
  ): Record<string, unknown> {
    const protocolState: Record<string, unknown> = {};

    if ('enabled' in state) {
      protocolState.config = { on: state.enabled };
    }

    return protocolState;
  }

  fromProtocolState(
    protocolState: Record<string, unknown>,
  ): Partial<PowerControlState & ButtonControlState> {
    const state = protocolState as {
      buttonevent?: number;
      lastupdated?: string;
      battery?: number;
      config?: { reachable?: boolean };
    };

    return {
      buttonEvent: state.buttonevent || 0,
      lastUpdated: state.lastupdated || new Date().toISOString(),
      battery: state.battery || 0,
      reachable: state.config?.reachable ?? true,
    };
  }
}

type HueDevice =
  | HueLightDevice
  | HueMotionSensorDevice
  | HueTemperatureSensorDevice
  | HueDimmerSwitchDevice;

interface HueResponse {
  success?: Record<string, unknown>;
  error?: {
    type: number;
    address: string;
    description: string;
  };
}

// Simplified HueProtocol
class HueProtocol implements DeviceProtocol {
  private connected = false;
  private stateChangeCallbacks: ((state: Partial<DeviceState>) => void)[] = [];
  private eventCallbacks: ((event: DeviceEvent) => void)[] = [];
  private connectionCallbacks: ((connected: boolean) => void)[] = [];
  private pollingInterval?: NodeJS.Timeout;

  constructor(
    private deviceId: DeviceId,
    private hubAddress: string,
    private config: {
      username: string;
      deviceId: string;
      deviceType: 'lights' | 'sensors';
    },
    private pollInterval = 2000,
  ) {}

  private get baseUrl(): string {
    return `http://${this.hubAddress}/api/${this.config.username}`;
  }

  async connect(): Promise<void> {
    try {
      await this.getState();
      this.connected = true;
      this.notifyConnectionChange(true);
      this.startPolling();
    } catch (error) {
      console.error('Failed to connect to Hue bridge:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.stopPolling();
    this.notifyConnectionChange(false);
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async fetchDeviceState(): Promise<Record<string, unknown>> {
    const response = await fetch(
      `${this.baseUrl}/${this.config.deviceType}/${this.config.deviceId}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.state || data;
  }

  async getState(): Promise<DeviceState> {
    const protocolState = await this.fetchDeviceState();
    return protocolState;
  }

  async setState(properties: Record<string, unknown>): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/${this.config.deviceType}/${this.config.deviceId}/state`,
      {
        method: 'PUT',
        body: JSON.stringify(properties),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const results: HueResponse[] = await response.json();
    const error = results.find((r) => r.error);
    if (error?.error) {
      throw new Error(`Hue error: ${error.error.description}`);
    }

    this.notifyStateChange(properties);
  }

  onStateChange(callback: (state: Partial<DeviceState>) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  onEvent(callback: (event: DeviceEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  onConnectionChange(callback: (connected: boolean) => void): void {
    this.connectionCallbacks.push(callback);
  }

  private notifyStateChange(state: Partial<DeviceState>): void {
    for (const callback of this.stateChangeCallbacks) {
      callback(state);
    }
  }

  private notifyEvent(event: DeviceEvent): void {
    for (const callback of this.eventCallbacks) {
      callback(event);
    }
  }

  private notifyConnectionChange(connected: boolean): void {
    for (const callback of this.connectionCallbacks) {
      callback(connected);
    }
  }

  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      try {
        const newState = await this.getState();
        this.notifyStateChange(newState);
      } catch (error) {
        console.error('Polling error:', error);
        this.connected = false;
        this.notifyConnectionChange(false);
      }
    }, this.pollInterval);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }
}

// Home Automation System
class HomeAutomationSystem {
  private devices: Map<DeviceId, Device> = new Map();
  private scenes: Map<string, Scene> = new Map();

  addDevice(device: Device): void {
    this.devices.set(device.id, device);
  }

  getDevice(id: DeviceId): Device | undefined {
    return this.devices.get(id);
  }

  createScene(name: string, actions: DeviceAction[]): Scene {
    const scene = new Scene(name, actions);
    this.scenes.set(name, scene);
    return scene;
  }
}

// Scenes and Automation
interface DeviceAction {
  deviceId: DeviceId;
  state: Partial<DeviceState>;
}

class Scene {
  constructor(
    public readonly name: string,
    private actions: DeviceAction[],
  ) {}

  async execute(system: HomeAutomationSystem): Promise<void> {
    await Promise.all(
      this.actions.map(async (action) => {
        const device = system.getDevice(action.deviceId);
        if (device) {
          await device.setState(action.state);
        }
      }),
    );
  }
}

// Example Usage
async function main() {
  const system = new HomeAutomationSystem();

  const hueLight = new HueLightDevice(
    'hue-light-1',
    'Living Room Light',
    new HueProtocol('hue-light-1', '192.168.1.100', {
      username: 'bridge-user',
      deviceId: '1',
      deviceType: 'lights',
    }),
  );

  const motionSensor = new HueMotionSensorDevice(
    'hue-sensor-1',
    'Living Room Motion',
    new HueProtocol('hue-sensor-1', '192.168.1.100', {
      username: 'bridge-user',
      deviceId: '2',
      deviceType: 'sensors',
    }),
  );

  await Promise.all([hueLight.initialize(), motionSensor.initialize()]);

  system.addDevice(hueLight);
  system.addDevice(motionSensor);

  // Create an automation using capabilities
  if (
    motionSensor.hasCapability('motion-sensing') &&
    hueLight.hasCapability('power-control')
  ) {
    const motionSensing =
      motionSensor.getCapability<MotionSensing>('motion-sensing');
    const powerControl = hueLight.getCapability<PowerControl>('power-control');

    motionSensing?.onMotionDetected(async () => {
      if (powerControl) {
        await powerControl.turnOn();
        if (hueLight.hasCapability('brightness-control')) {
          const brightnessControl =
            hueLight.getCapability<BrightnessControl>('brightness-control');
          await brightnessControl?.setBrightness(100);
        }
      }
    });
  }
}

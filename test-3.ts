// Core Types
type DeviceId = string;

// State Management
type StateKey<T> = { __type: T };
type StateValue<T> = { value: T; timestamp: number };
type DeviceState = Map<StateKey<any>, StateValue<any>>;

// Strongly typed state keys
const PowerState = { __type: 'boolean' } as StateKey<boolean>;
const BrightnessState = { __type: 'number' } as StateKey<number>;
const ColorState = { __type: 'Color' } as StateKey<Color>;
const MotionState = { __type: 'boolean' } as StateKey<boolean>;
const TemperatureState = { __type: 'number' } as StateKey<number>;

// Value Types
interface Color {
  hue: number; // 0-360
  saturation: number; // 0-100
  brightness: number; // 0-100
}

// Capability Interface
interface Capability<T extends Record<string, StateKey<any>>> {
  readonly type: string;
  readonly stateKeys: T;
  readonly commands: Set<string>;
}

// Core Capabilities
const PowerCapability: Capability<{ power: StateKey<boolean> }> = {
  type: 'power',
  stateKeys: { power: PowerState },
  commands: new Set(['turnOn', 'turnOff']),
};

const BrightnessCapability: Capability<{ brightness: StateKey<number> }> = {
  type: 'brightness',
  stateKeys: { brightness: BrightnessState },
  commands: new Set(['setBrightness']),
};

const ColorCapability: Capability<{ color: StateKey<Color> }> = {
  type: 'color',
  stateKeys: { color: ColorState },
  commands: new Set(['setColor']),
};

const MotionCapability: Capability<{ motion: StateKey<boolean> }> = {
  type: 'motion',
  stateKeys: { motion: MotionState },
  commands: new Set([]),
};

const TemperatureCapability: Capability<{ temperature: StateKey<number> }> = {
  type: 'temperature',
  stateKeys: { temperature: TemperatureState },
  commands: new Set([]),
};

// Device Protocol Interface
interface DeviceProtocol {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand(command: string, args: unknown[]): Promise<void>;
  onStateChange(
    callback: (state: Partial<Record<string, unknown>>) => void,
  ): () => void;
}

// Device Class
class Device {
  private state = new Map<StateKey<any>, StateValue<any>>();
  private capabilities = new Set<Capability<any>>();
  private stateSubscriptions = new Map<
    StateKey<any>,
    Set<(value: any) => void>
  >();
  private commandHandlers = new Map<
    string,
    (args: unknown[]) => Promise<void>
  >();

  constructor(
    public readonly id: DeviceId,
    public readonly name: string,
    private protocol: DeviceProtocol,
  ) {
    protocol.onStateChange((newState) => this.handleStateChange(newState));
  }

  // Capability Management
  addCapability<T extends Record<string, StateKey<any>>>(
    capability: Capability<T>,
    handlers: Partial<Record<string, (args: unknown[]) => Promise<void>>>,
  ): void {
    this.capabilities.add(capability);

    // Initialize state for all capability state keys
    for (const key of Object.values(capability.stateKeys)) {
      if (!this.state.has(key)) {
        this.state.set(key, { value: null, timestamp: Date.now() });
      }
    }

    // Register command handlers
    for (const [command, handler] of Object.entries(handlers)) {
      if (capability.commands.has(command) && handler) {
        this.commandHandlers.set(command, handler);
      }
    }
  }

  hasCapability<T extends Record<string, StateKey<any>>>(
    capability: Capability<T>,
  ): boolean {
    return this.capabilities.has(capability);
  }

  // State Management
  getState<T>(key: StateKey<T>): T | null {
    return this.state.get(key)?.value ?? null;
  }

  private setState<T>(key: StateKey<T>, value: T): void {
    const timestamp = Date.now();
    this.state.set(key, { value, timestamp });

    // Notify subscribers
    const subscribers = this.stateSubscriptions.get(key);
    if (subscribers) {
      for (const callback of subscribers) {
        callback(value);
      }
    }
  }

  // Command Handling
  async executeCommand(command: string, args: unknown[] = []): Promise<void> {
    const handler = this.commandHandlers.get(command);
    if (!handler) {
      throw new Error(`Unknown command: ${command}`);
    }
    await handler(args);
  }

  // State Subscriptions
  onStateChange<T>(key: StateKey<T>, callback: (value: T) => void): () => void {
    let subscribers = this.stateSubscriptions.get(key);
    if (!subscribers) {
      subscribers = new Set();
      this.stateSubscriptions.set(key, subscribers);
    }
    subscribers.add(callback);
    return () => subscribers?.delete(callback);
  }

  private handleStateChange(newState: Partial<Record<string, unknown>>): void {
    for (const [key, value] of Object.entries(newState)) {
      // Find the corresponding state key
      for (const capability of this.capabilities) {
        const stateKey = Object.entries(capability.stateKeys).find(
          ([name]) => name === key,
        )?.[1];
        if (stateKey) {
          this.setState(stateKey, value);
          break;
        }
      }
    }
  }
}

// Example Protocol Implementation
class HueProtocol implements DeviceProtocol {
  private connected = false;
  private stateChangeCallbacks: Array<
    (state: Partial<Record<string, unknown>>) => void
  > = [];

  constructor(
    private bridgeAddress: string,
    private username: string,
    private deviceId: string,
  ) {}

  async connect(): Promise<void> {
    // Implement connection logic
  }

  async disconnect(): Promise<void> {
    // Implement disconnection logic
  }

  async sendCommand(command: string, args: unknown[]): Promise<void> {
    const state = this.translateToHue(command, args);
    await this.sendStateUpdate(state);
  }

  onStateChange(
    callback: (state: Partial<Record<string, unknown>>) => void,
  ): () => void {
    this.stateChangeCallbacks.push(callback);
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  private translateToHue(
    command: string,
    args: unknown[],
  ): Record<string, unknown> {
    switch (command) {
      case 'turnOn':
        return { on: true };
      case 'turnOff':
        return { on: false };
      case 'setBrightness':
        return { bri: Math.round(((args[0] as number) / 100) * 254) };
      case 'setColor': {
        const color = args[0] as Color;
        return {
          hue: Math.round((color.hue / 360) * 65535),
          sat: Math.round((color.saturation / 100) * 254),
          bri: Math.round((color.brightness / 100) * 254),
        };
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  private async sendStateUpdate(state: Record<string, unknown>): Promise<void> {
    const url = `http://${this.bridgeAddress}/api/${this.username}/lights/${this.deviceId}/state`;
    const response = await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      throw new Error(`Failed to update state: ${response.statusText}`);
    }
  }
}

// Example Usage
async function main() {
  // Create a Hue light
  const light = new Device(
    'light1',
    'Living Room Light',
    new HueProtocol('192.168.1.100', 'username', 'light1'),
  );

  // Add capabilities with their command handlers
  light.addCapability(PowerCapability, {
    turnOn: async () => light.protocol.sendCommand('turnOn', []),
    turnOff: async () => light.protocol.sendCommand('turnOff', []),
  });

  light.addCapability(BrightnessCapability, {
    setBrightness: async ([level]) =>
      light.protocol.sendCommand('setBrightness', [level]),
  });

  light.addCapability(ColorCapability, {
    setColor: async ([color]) =>
      light.protocol.sendCommand('setColor', [color]),
  });

  // Subscribe to state changes
  light.onStateChange(PowerState, (isOn) => {
    console.log('Power state changed:', isOn);
  });

  light.onStateChange(BrightnessState, (level) => {
    console.log('Brightness changed:', level);
  });

  // Control the light
  await light.executeCommand('turnOn');
  await light.executeCommand('setBrightness', [100]);
  await light.executeCommand('setColor', [
    {
      hue: 240,
      saturation: 100,
      brightness: 100,
    },
  ]);
}

// Automation System
class AutomationRule {
  constructor(
    private condition: () => boolean,
    private action: () => Promise<void>,
    private options: {
      throttle?: number;
      debounce?: number;
    } = {},
  ) {}

  private lastRun = 0;

  async evaluate(): Promise<void> {
    const now = Date.now();

    if (this.options.throttle && now - this.lastRun < this.options.throttle) {
      return;
    }

    if (this.condition()) {
      this.lastRun = now;
      await this.action();
    }
  }
}

class AutomationSystem {
  private rules: AutomationRule[] = [];
  private interval: NodeJS.Timeout | null = null;

  addRule(rule: AutomationRule): void {
    this.rules.push(rule);
  }

  start(interval = 1000): void {
    this.interval = setInterval(() => {
      for (const rule of this.rules) {
        rule.evaluate().catch(console.error);
      }
    }, interval);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// Example Automation
function createMotionLightRule(
  motionSensor: Device,
  light: Device,
): AutomationRule {
  return new AutomationRule(
    // Condition
    () => motionSensor.getState(MotionState) === true,
    // Action
    async () => {
      await light.executeCommand('turnOn');
      await light.executeCommand('setBrightness', [100]);
    },
    // Options
    { throttle: 1000 }, // Prevent rapid on/off
  );
}

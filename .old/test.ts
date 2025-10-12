// Base interfaces for device communication
interface Message {
  type: string;
  payload: unknown;
}

interface DeviceState {
  [key: string]: unknown;
}

// Protocol handling
interface ProtocolHandler {
  translateCommand(
    capability: string,
    command: string,
    params?: unknown,
  ): Message;
  translateState(message: Message): { capability: string; state: DeviceState };
}

// Core capability interfaces
interface Capability {
  name: string;
  type: string;
  getState(): Promise<DeviceState>;
  handleMessage(message: Message): Promise<void>;
}

interface Device {
  id: string;
  name: string;
  type: string;
  transport: Transport;
  capabilities: Map<string, Capability>;
  state: DeviceState;

  initialize(): Promise<void>;
  addCapability(capability: Capability): void;
  getCapability<T extends Capability>(type: string): T | undefined;
}

// Example capabilities
interface OnOffCapability extends Capability {
  type: 'on-off';
  turnOn(): Promise<void>;
  turnOff(): Promise<void>;
  isOn(): boolean;
}

interface DimmerCapability extends Capability {
  type: 'dimmer';
  setBrightness(level: number): Promise<void>;
  getBrightness(): number;
}

interface SensorCapability extends Capability {
  type: 'sensor';
  getValue(): number;
  getUnit(): string;
}

// Base implementation classes
abstract class BaseCapability implements Capability {
  constructor(
    public name: string,
    public type: string,
    protected device: Device,
  ) {}

  abstract getState(): Promise<DeviceState>;
  abstract handleMessage(message: Message): Promise<void>;
}

abstract class BaseDevice implements Device {
  public capabilities: Map<string, Capability> = new Map();
  public state: DeviceState = {};

  constructor(
    public id: string,
    public name: string,
    public type: string,
    public transport: Transport,
  ) {}

  abstract initialize(): Promise<void>;

  addCapability(capability: Capability): void {
    this.capabilities.set(capability.type, capability);
  }

  getCapability<T extends Capability>(type: string): T | undefined {
    return this.capabilities.get(type) as T;
  }
}

// Example protocol handlers
class DysonProtocolHandler implements ProtocolHandler {
  translateCommand(
    capability: string,
    command: string,
    params?: unknown,
  ): Message {
    switch (capability) {
      case 'on-off':
        return {
          type: 'command',
          payload: { power: command === 'turnOn' ? 'ON' : 'OFF' },
        };
      case 'fan-speed':
        return {
          type: 'command',
          payload: { speed: params },
        };
      default:
        throw new Error(`Unsupported capability: ${capability}`);
    }
  }

  translateState(message: Message): { capability: string; state: DeviceState } {
    if (message.type === 'status' && typeof message.payload === 'object') {
      const payload = message.payload as { power?: string; speed?: number };
      if (payload.power !== undefined) {
        return {
          capability: 'on-off',
          state: { isOn: payload.power === 'ON' },
        };
      }
      if (payload.speed !== undefined) {
        return {
          capability: 'fan-speed',
          state: { speed: payload.speed },
        };
      }
    }
    throw new Error('Unhandled message type or payload');
  }
}

class PhilipsHueProtocolHandler implements ProtocolHandler {
  translateCommand(
    capability: string,
    command: string,
    params?: unknown,
  ): Message {
    switch (capability) {
      case 'on-off':
        return {
          type: 'command',
          payload: { on: command === 'turnOn' },
        };
      case 'dimmer':
        return {
          type: 'command',
          payload: { bri: params },
        };
      default:
        throw new Error(`Unsupported capability: ${capability}`);
    }
  }

  translateState(message: Message): { capability: string; state: DeviceState } {
    if (message.type === 'status' && typeof message.payload === 'object') {
      const payload = message.payload as { on?: boolean; bri?: number };
      if (payload.on !== undefined) {
        return {
          capability: 'on-off',
          state: { isOn: payload.on },
        };
      }
      if (payload.bri !== undefined) {
        return {
          capability: 'dimmer',
          state: { brightness: payload.bri },
        };
      }
    }
    throw new Error('Unhandled message type or payload');
  }
}

// Updated Transport interface and implementation
interface Transport {
  send(message: Message): Promise<void>;
  subscribe(callback: (message: Message) => void): void;
  disconnect(): Promise<void>;
  getProtocolHandler(): ProtocolHandler;
}

class HubTransport implements Transport {
  private protocolHandler: ProtocolHandler;

  constructor(
    private hubId: string,
    private deviceId: string,
    protocol: string,
  ) {
    // In a real implementation, this would be more dynamic
    switch (protocol) {
      case 'dyson':
        this.protocolHandler = new DysonProtocolHandler();
        break;
      case 'hue':
        this.protocolHandler = new PhilipsHueProtocolHandler();
        break;
      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  getProtocolHandler(): ProtocolHandler {
    return this.protocolHandler;
  }

  async send(message: Message): Promise<void> {
    console.log(
      `Sending to hub ${this.hubId} for device ${this.deviceId}:`,
      message,
    );
  }

  subscribe(callback: (message: Message) => void): void {
    console.log(
      `Subscribed to messages from hub ${this.hubId} for device ${this.deviceId}`,
    );
  }

  async disconnect(): Promise<void> {
    // Clean up hub connection
  }
}

// Generic capability implementations
class OnOffCapability extends BaseCapability implements OnOffCapability {
  type = 'on-off' as const;
  private _isOn = false;

  async turnOn(): Promise<void> {
    const message = this.device.transport
      .getProtocolHandler()
      .translateCommand(this.type, 'turnOn');
    await this.device.transport.send(message);
    this._isOn = true;
  }

  async turnOff(): Promise<void> {
    const message = this.device.transport
      .getProtocolHandler()
      .translateCommand(this.type, 'turnOff');
    await this.device.transport.send(message);
    this._isOn = false;
  }

  isOn(): boolean {
    return this._isOn;
  }

  async getState(): Promise<DeviceState> {
    return { isOn: this._isOn };
  }

  async handleMessage(message: Message): Promise<void> {
    try {
      const { state } = this.device.transport
        .getProtocolHandler()
        .translateState(message);
      if ('isOn' in state) {
        this._isOn = state.isOn as boolean;
      }
    } catch (error) {
      // Message wasn't for this capability
    }
  }
}

class DimmerCapability extends BaseCapability implements DimmerCapability {
  type = 'dimmer' as const;
  private _brightness = 0;

  async setBrightness(level: number): Promise<void> {
    const message = this.device.transport
      .getProtocolHandler()
      .translateCommand(this.type, 'setBrightness', level);
    await this.device.transport.send(message);
    this._brightness = level;
  }

  getBrightness(): number {
    return this._brightness;
  }

  async getState(): Promise<DeviceState> {
    return { brightness: this._brightness };
  }

  async handleMessage(message: Message): Promise<void> {
    try {
      const { state } = this.device.transport
        .getProtocolHandler()
        .translateState(message);
      if ('brightness' in state) {
        this._brightness = state.brightness as number;
      }
    } catch (error) {
      // Message wasn't for this capability
    }
  }
}

// Example device implementations
class DysonFanDevice extends BaseDevice {
  constructor(id: string, name: string, transport: Transport) {
    super(id, name, 'dyson-fan', transport);
    this.addCapability(new OnOffCapability('power', 'on-off', this));
  }

  async initialize(): Promise<void> {
    this.transport.subscribe(async (message) => {
      for (const capability of this.capabilities.values()) {
        await capability.handleMessage(message);
      }
    });

    await this.transport.send({
      type: 'query',
      payload: { state: 'all' },
    });
  }
}

class PhilipsHueLight extends BaseDevice {
  constructor(id: string, name: string, transport: Transport) {
    super(id, name, 'hue-light', transport);
    this.addCapability(new OnOffCapability('power', 'on-off', this));
    this.addCapability(new DimmerCapability('brightness', 'dimmer', this));
  }

  async initialize(): Promise<void> {
    this.transport.subscribe(async (message) => {
      for (const capability of this.capabilities.values()) {
        await capability.handleMessage(message);
      }
    });

    await this.transport.send({
      type: 'query',
      payload: { state: 'all' },
    });
  }
}

// Example usage
async function main() {
  // Dyson Fan example
  const dysonTransport = new HubTransport('hub1', 'fan1', 'dyson');
  const fan = new DysonFanDevice('fan1', 'Living Room Fan', dysonTransport);
  await fan.initialize();

  // Philips Hue Light example
  const hueTransport = new HubTransport('hub1', 'light1', 'hue');
  const light = new PhilipsHueLight(
    'light1',
    'Living Room Light',
    hueTransport,
  );
  await light.initialize();

  // Both devices can use the same capability interface
  const fanPower = fan.getCapability<OnOffCapability>('on-off');
  const lightPower = light.getCapability<OnOffCapability>('on-off');
  const lightDimmer = light.getCapability<DimmerCapability>('dimmer');

  if (fanPower && lightPower && lightDimmer) {
    await fanPower.turnOn();
    await lightPower.turnOn();
    await lightDimmer.setBrightness(75);
  }
}

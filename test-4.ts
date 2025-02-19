import { EventEmitter } from 'node:events';

interface ShadowState {
  desired: Record<string, unknown>;
  reported: Record<string, unknown>;
  delta: Record<string, unknown>;
}

interface Device {
  type: string;
  shadowState: ShadowState;
}

interface DiscoveredDevice extends Device {
  name: string;
  ipAddress: string;
}

interface SendCommandProps {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

interface ProtocolAdapter {
  devices: DiscoveredDevice[];
  commandsQueue?: {
    [key: string]: SendCommandProps[];
  };
  isConnected: boolean;
  isDiscovering: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startDiscovery(): () => void; // returns a function to stop the discovery
  sendCommand(props: SendCommandProps): Promise<void>;
  subscribe(callback: (device: DiscoveredDevice) => void): () => void; // returns a function to unsubscribe
  authenticate(): Promise<void>; // type this to an auth token
}

abstract class BaseAdapter extends EventEmitter implements ProtocolAdapter {
  devices: DiscoveredDevice[] = [];
  isConnected = false;
  isDiscovering = false;
  commandsQueue: {
    [key: string]: SendCommandProps[];
  } = {};

  async connect(): Promise<void> {
    await this.doConnect();
    this.emit('connect');
  }

  async disconnect(): Promise<void> {
    await this.doDisconnect();
    this.emit('disconnect');
  }

  startDiscovery(): () => void {
    this.doStartDiscovery();
    this.emit('startDiscovery');
    return () => this.emit('stopDiscovery');
  }

  async sendCommand(props: SendCommandProps): Promise<void> {
    await this.doSendCommand(props);
    this.emit('sendCommand', props);
  }

  subscribe(callback: (device: DiscoveredDevice) => void): () => void {
    this.doSubscribe(callback);
    this.emit('subscribe', callback);
    return () => {
      this.doUnsubscribe(callback);
      this.emit('unsubscribe', callback);
    };
  }

  async authenticate(): Promise<void> {
    await this.doAuthenticate();
    this.emit('authenticate');
  }

  protected abstract doConnect(): Promise<void>;
  protected abstract doDisconnect(): Promise<void>;
  protected abstract doStartDiscovery(): void;
  protected abstract doStopDiscovery(): void;
  protected abstract doSendCommand(props: SendCommandProps): Promise<void>;
  protected abstract doSubscribe(
    callback: (device: DiscoveredDevice) => void,
  ): void;
  protected abstract doUnsubscribe(
    callback: (device: DiscoveredDevice) => void,
  ): void;
  protected abstract doAuthenticate(): Promise<void>;
}

class WiFiProtocolAdapter extends BaseAdapter {
  protected doConnect(): Promise<void> {
    console.log('Connecting to WiFi');
    return Promise.resolve();
  }

  protected doDisconnect(): Promise<void> {
    console.log('Disconnecting from WiFi');
    return Promise.resolve();
  }

  protected doSendCommand(props: SendCommandProps): Promise<void> {
    console.log('Sending command to WiFi', props);
    return Promise.resolve();
  }

  protected doSubscribe(callback: (device: DiscoveredDevice) => void): void {
    console.log('Subscribing to WiFi', callback);
  }

  protected doUnsubscribe(callback: (device: DiscoveredDevice) => void): void {
    console.log('Unsubscribing from WiFi', callback);
  }

  protected doAuthenticate(): Promise<void> {
    console.log('Authenticating to WiFi');
    return Promise.resolve();
  }

  protected doStartDiscovery(): void {
    console.log('Starting discovery');
  }

  protected doStopDiscovery(): void {
    console.log('Stopping discovery');
  }
}

(async () => {
  const adapter = new WiFiProtocolAdapter();

  await adapter.connect();

  adapter.subscribe((device) => {
    console.log('Device discovered', device);
  });

  await adapter.sendCommand({
    endpoint: '/api/v1/devices',
    method: 'GET',
  });
})();

class HueLight {
  private _brightness: number;
  private _color: string;
  private _power: boolean;

  constructor() {
    this._brightness = 0;
  }
}

# Adding New Protocols to Cove

This guide walks you through adding a new protocol implementation to the Cove home automation platform.

## Overview

The Cove protocols package follows a consistent architecture for all protocol implementations. Each protocol consists of:

1. **Types** - Protocol-specific type definitions
2. **Discovery** - How to find devices on the network
3. **Client** - Core protocol implementation
4. **Tests** - Comprehensive test coverage

## Architecture Pattern

### Directory Structure

```
packages/protocols/src/
├── <protocol-name>/
│   ├── index.ts          # Public exports
│   ├── types.ts          # Type definitions
│   ├── discovery.ts      # Device discovery logic
│   ├── client.ts         # Main protocol client
│   └── README.md         # Protocol-specific docs
└── index.ts              # Package exports

packages/protocols/tests/
└── <protocol-name>/
    ├── discovery.test.ts
    ├── client.test.ts
    └── mock-*.ts         # Mock implementations
```

## Step-by-Step Guide

### 1. Define Types (`types.ts`)

Start by defining the core types for your protocol. Use the Hue implementation as a reference:

```typescript
// Example: Zigbee types
export interface ZigbeeDevice {
  ieee_address: string;
  friendly_name: string;
  model: string;
  manufacturer: string;
  // ... protocol-specific fields
}

export interface ZigbeeDeviceState {
  state: 'ON' | 'OFF';
  brightness?: number;
  color_temp?: number;
  // ... protocol-specific state
}
```

**Key Principles:**
- Use clear, descriptive names
- Include JSDoc comments for complex types
- Keep types focused and composable
- Export all public types

### 2. Implement Discovery (`discovery.ts`)

Discovery can use mDNS, HTTP endpoints, or protocol-specific methods:

```typescript
import Bonjour from 'bonjour-service';

export const PROTOCOL_MDNS_SERVICE_TYPE = '_your-protocol._tcp';

export interface DiscoveredDevice {
  id: string;
  name: string;
  ipAddress: string;
  // ... discovery metadata
}

export async function discoverDevices(
  timeoutMs = 5000
): Promise<DiscoveredDevice[]> {
  // Implement discovery logic
}
```

**Discovery Methods:**
- **mDNS/Bonjour** - Local network service discovery (Hue, ESPHome)
- **HTTP API** - Cloud or local HTTP endpoints (Hue HTTPS discovery)
- **Broadcast** - UDP broadcast packets
- **Scanning** - Port scanning or network scanning

### 3. Build the Client (`client.ts`)

The client is the heart of your protocol implementation. It should extend `EventEmitter` for real-time updates:

```typescript
import { EventEmitter } from 'node:events';

export interface ClientOptions {
  host: string;
  port?: number;
  // ... protocol-specific options
}

export class YourProtocolClient extends EventEmitter {
  private connected = false;

  constructor(options: ClientOptions) {
    super();
    // Initialize client
  }

  async connect(): Promise<void> {
    // Establish connection
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    // Close connection
    this.connected = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Protocol-specific methods
  async getDevices(): Promise<Device[]> { }
  async sendCommand(deviceId: string, command: Command): Promise<void> { }
}
```

**Client Requirements:**
- Extend `EventEmitter` for events
- Implement connection lifecycle (`connect`, `disconnect`)
- Handle authentication if needed
- Emit events for state changes
- Include comprehensive error handling

### 4. Export Everything (`index.ts`)

```typescript
/**
 * Your Protocol Implementation
 *
 * Brief description of the protocol and what it supports.
 */

export { YourProtocolClient } from './client';
export { discoverDevices, PROTOCOL_MDNS_SERVICE_TYPE } from './discovery';
export type * from './types';
```

### 5. Update Package Exports

Add your protocol to `packages/protocols/package.json`:

```json
{
  "exports": {
    "./your-protocol": "./src/your-protocol/index.ts"
  }
}
```

And to `packages/protocols/src/index.ts`:

```typescript
export * as yourProtocol from './your-protocol';
```

### 6. Add Protocol Type

Update `packages/types/src/device.ts`:

```typescript
export enum ProtocolType {
  ESPHome = 'esphome',
  Hue = 'hue',
  YourProtocol = 'your-protocol', // NEW
  // ...
}
```

### 7. Add Discovery Support

Update `packages/discovery/src/mdns.ts`:

```typescript
private mapServiceTypeToProtocol(serviceType: string): ProtocolType {
  if (serviceType.includes('your-protocol')) return 'your-protocol' as ProtocolType;
  // ...
}
```

### 8. Create Hub Adapter

Create `packages/hub/src/adapters/your-protocol.ts`:

```typescript
import { debug } from '@cove/logger';
import { YourProtocolClient } from '@cove/protocols/your-protocol';
import type { Device, DeviceCommand, ProtocolAdapter, ProtocolType } from '@cove/types';

const log = debug('cove:hub:adapter:your-protocol');

export class YourProtocolAdapter implements ProtocolAdapter {
  readonly name = 'Your Protocol Adapter';
  readonly protocol: ProtocolType = 'your-protocol' as ProtocolType;

  async initialize(): Promise<void> {
    log('Initializing adapter');
  }

  async shutdown(): Promise<void> {
    log('Shutting down adapter');
  }

  async startDiscovery(): Promise<void> { }
  async stopDiscovery(): Promise<void> { }

  async connect(device: Device): Promise<void> {
    // Connect to device
  }

  async disconnect(device: Device): Promise<void> {
    // Disconnect from device
  }

  async sendCommand(device: Device, command: DeviceCommand): Promise<void> {
    // Send command to device
  }

  async pollState?(device: Device): Promise<void> {
    // Optional: Poll device state
  }
}
```

**Adapter Requirements:**
- Implement `ProtocolAdapter` interface
- Manage device connections
- Map Cove commands to protocol commands
- Handle state updates

### 9. Register Adapter in Daemon

Update `packages/hub/src/daemon.ts`:

```typescript
private initializeAdapters(): void {
  const yourProtocolAdapter = new YourProtocolAdapter();
  this.protocolAdapters.set(ProtocolType.YourProtocol, yourProtocolAdapter);
  log('Registered YourProtocol adapter');
}
```

## Testing

### 10. Create Mock Implementation

Create a mock server/device for testing:

```typescript
// tests/your-protocol/mock-device.ts
export class MockYourProtocolDevice {
  private server: ReturnType<typeof Bun.serve> | null = null;

  start(): void {
    this.server = Bun.serve({
      port: 8080,
      fetch: (req) => this.handleRequest(req),
    });
  }

  stop(): void {
    this.server?.stop();
  }

  private handleRequest(req: Request): Response {
    // Mock protocol responses
  }
}
```

### 11. Write Tests

Create comprehensive test coverage:

```typescript
// tests/your-protocol/client.test.ts
import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { YourProtocolClient } from '../../src/your-protocol';
import { MockYourProtocolDevice } from './mock-device';

describe('YourProtocolClient', () => {
  let mockDevice: MockYourProtocolDevice;
  let client: YourProtocolClient;

  beforeAll(() => {
    mockDevice = new MockYourProtocolDevice();
    mockDevice.start();
  });

  afterAll(() => {
    mockDevice.stop();
  });

  describe('Connection', () => {
    it('should connect successfully', async () => {
      client = new YourProtocolClient({ host: 'localhost' });
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });
  });
});
```

## Reference Implementations

### ESPHome

- **Complexity**: High (TCP, Protobuf, binary protocol)
- **Features**: Real-time state updates, command support, entity discovery
- **Location**: `packages/protocols/src/esphome/`
- **Key Files**: `native/client.ts`, `native/protocol.ts`, `native/messages.ts`

**Best for learning:**
- Binary protocol parsing
- Real-time state streaming
- Complex message handling

### Philips Hue

- **Complexity**: Medium (REST API, JSON)
- **Features**: Discovery, authentication, device control
- **Location**: `packages/protocols/src/hue/`
- **Key Files**: `client.ts`, `discovery.ts`, `types.ts`

**Best for learning:**
- HTTP/REST protocols
- Discovery patterns (mDNS + HTTPS)
- Authentication flows
- State polling

### Choose Your Starting Point

1. **REST API protocols** → Start with Hue
2. **Binary/TCP protocols** → Start with ESPHome
3. **Simple protocols** → Create your own from scratch

## Best Practices

### Code Quality

1. **Type Safety** - Use TypeScript strictly, avoid `any`
2. **Error Handling** - Wrap external calls in try/catch
3. **Logging** - Use `@cove/logger` with appropriate namespaces
4. **Testing** - Aim for >80% code coverage

### Performance

1. **Connection Pooling** - Reuse connections when possible
2. **Timeouts** - Always set timeouts on network calls
3. **Buffering** - Buffer rapid state updates
4. **Cleanup** - Properly clean up resources on disconnect

### Documentation

1. **JSDoc** - Document all public APIs
2. **README** - Protocol overview, usage examples, API reference
3. **Examples** - Include working code examples
4. **Troubleshooting** - Common issues and solutions

## Checklist

Use this checklist when implementing a new protocol:

- [ ] Types defined (`types.ts`)
- [ ] Discovery implemented (`discovery.ts`)
- [ ] Client implemented (`client.ts`)
- [ ] Protocol README created
- [ ] Exports configured (`index.ts`, `package.json`)
- [ ] Protocol type added to `@cove/types`
- [ ] Discovery mapping added
- [ ] Hub adapter created
- [ ] Adapter registered in daemon
- [ ] Mock implementation created
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests written (optional, gated)
- [ ] Documentation complete

## Getting Help

- **Reference Implementations**: Study ESPHome and Hue implementations
- **Protocol Docs**: Read official protocol specifications
- **Community**: Ask in Cove Discord or GitHub Discussions
- **Examples**: Check tests for working examples

## Common Patterns

### Authentication

```typescript
async authenticate(credentials: Credentials): Promise<string> {
  const response = await fetch(`${this.baseURL}/auth`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  const { token } = await response.json();
  this.token = token;
  return token;
}
```

### Real-time Updates

```typescript
private setupEventStream(): void {
  this.socket.on('state', (data) => {
    const state = this.parseState(data);
    this.emit('stateChange', state);
  });
}
```

### State Polling

```typescript
async pollState(): Promise<void> {
  const state = await this.getState();
  this.emit('stateChange', state);
}

startPolling(intervalMs = 5000): void {
  this.pollingInterval = setInterval(() => {
    this.pollState();
  }, intervalMs);
}
```

## Next Steps

1. Read through the ESPHome or Hue implementation
2. Set up your protocol's types and discovery
3. Implement the core client
4. Create tests with mock devices
5. Build the hub adapter
6. Test end-to-end with the daemon

Happy building! 🚀


#!/usr/bin/env bun
/**
 * Protocol Template Generator
 *
 * Scaffolds a new protocol implementation with all boilerplate files.
 *
 * Usage:
 *   bun run scripts/create-protocol.ts <protocol-name>
 *
 * Example:
 *   bun run scripts/create-protocol.ts zigbee
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface ProtocolConfig {
  name: string; // e.g., "zigbee"
  displayName: string; // e.g., "Zigbee"
  description: string;
  defaultPort?: number;
  useTcp?: boolean;
  useHttp?: boolean;
  useMdns?: boolean;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Error: Protocol name is required');
    console.error('Usage: bun run scripts/create-protocol.ts <protocol-name>');
    console.error('Example: bun run scripts/create-protocol.ts zigbee');
    process.exit(1);
  }

  const protocolName = args[0].toLowerCase();
  const displayName =
    protocolName.charAt(0).toUpperCase() + protocolName.slice(1);

  console.log(`\n🚀 Creating new protocol: ${displayName}\n`);

  const config: ProtocolConfig = {
    defaultPort: 8080,
    description: `${displayName} protocol implementation for Cove`,
    displayName,
    name: protocolName,
    useHttp: true,
    useMdns: true,
    useTcp: false,
  };

  // Check if protocol already exists
  const protocolDir = join(process.cwd(), 'src', protocolName);
  if (existsSync(protocolDir)) {
    console.error(
      `❌ Error: Protocol "${protocolName}" already exists at ${protocolDir}`,
    );
    process.exit(1);
  }

  // Create directories
  await mkdir(protocolDir, { recursive: true });
  await mkdir(join(process.cwd(), 'tests', protocolName), { recursive: true });

  console.log('📁 Creating directory structure...');

  // Generate files
  await Promise.all([
    generateTypes(protocolDir, config),
    generateDiscovery(protocolDir, config),
    generateClient(protocolDir, config),
    generateIndex(protocolDir, config),
    generateReadme(protocolDir, config),
    generateTests(config),
  ]);

  console.log('\n✅ Protocol scaffolding complete!\n');
  console.log('📝 Next steps:');
  console.log(
    `   1. Implement discovery logic in src/${protocolName}/discovery.ts`,
  );
  console.log(
    `   2. Implement client methods in src/${protocolName}/client.ts`,
  );
  console.log(`   3. Add your types in src/${protocolName}/types.ts`);
  console.log(`   4. Write tests in tests/${protocolName}/`);
  console.log('   5. Update package.json exports');
  console.log('   6. Add protocol to @cove/types ProtocolType enum');
  console.log(
    `   7. Create hub adapter in packages/hub/src/adapters/${protocolName}.ts`,
  );
  console.log('\n📖 See ADDING_PROTOCOLS.md for detailed guide');
  console.log('');
}

async function generateTypes(
  dir: string,
  config: ProtocolConfig,
): Promise<void> {
  const content = `/**
 * ${config.displayName} Protocol Types
 */

/**
 * Configuration options for ${config.displayName} client
 */
export interface ${config.displayName}ClientOptions {
  host: string;
  port?: number;
  timeout?: number;
  // Add protocol-specific options here
}

/**
 * ${config.displayName} device representation
 */
export interface ${config.displayName}Device {
  id: string;
  name: string;
  type: string;
  // Add protocol-specific device fields
}

/**
 * ${config.displayName} device state
 */
export interface ${config.displayName}DeviceState {
  online: boolean;
  // Add protocol-specific state fields
}

/**
 * ${config.displayName} device discovery result
 */
export interface ${config.displayName}Discovery {
  id: string;
  name: string;
  ipAddress: string;
  port?: number;
  metadata?: Record<string, unknown>;
}
`;

  await writeFile(join(dir, 'types.ts'), content);
  console.log('   ✅ Created types.ts');
}

async function generateDiscovery(
  dir: string,
  config: ProtocolConfig,
): Promise<void> {
  const content = `/**
 * ${config.displayName} Device Discovery
 */

import { debug } from '@cove/logger';
import type { ${config.displayName}Discovery } from './types';

const log = debug('cove:protocols:${config.name}:discovery');

${
  config.useMdns
    ? `import Bonjour, { type Service } from 'bonjour-service';

export const ${config.name.toUpperCase()}_MDNS_SERVICE_TYPE = '_${config.name}._tcp';

/**
 * Discovers ${config.displayName} devices using mDNS
 */
export async function discover${config.displayName}DevicesMDNS(
  timeoutMs = 5000,
): Promise<${config.displayName}Discovery[]> {
  log('Discovering ${config.displayName} devices via mDNS');
  return new Promise((resolve) => {
    const bonjour = new Bonjour();
    const discovered: Map<string, ${config.displayName}Discovery> = new Map();

    const browser = bonjour.find({ type: ${config.name.toUpperCase()}_MDNS_SERVICE_TYPE });

    browser.on('up', (service: Service) => {
      if (service.addresses && service.addresses.length > 0) {
        const device: ${config.displayName}Discovery = {
          id: service.txt.deviceid || service.name,
          ipAddress: service.addresses[0],
          name: service.name,
          port: service.port,
        };
        discovered.set(device.id, device);
        log('Discovered device via mDNS:', device);
      }
    });

    setTimeout(() => {
      browser.stop();
      bonjour.destroy();
      log(\`mDNS discovery stopped. Found \${discovered.size} devices.\`);
      resolve(Array.from(discovered.values()));
    }, timeoutMs);
  });
}
`
    : ''
}

${
  config.useHttp
    ? `/**
 * Discovers ${config.displayName} devices using HTTP/REST API
 */
export async function discover${config.displayName}DevicesHTTP(): Promise<${config.displayName}Discovery[]> {
  log('Discovering ${config.displayName} devices via HTTP');

  // TODO: Implement HTTP-based discovery
  // Example: fetch('https://discovery.example.com/devices')

  return [];
}
`
    : ''
}

/**
 * Main discovery function - tries all available methods
 */
export async function discover${config.displayName}Devices(): Promise<${config.displayName}Discovery[]> {
  const devices: ${config.displayName}Discovery[] = [];

  ${config.useHttp ? `// Try HTTP discovery\n  try {\n    const httpDevices = await discover${config.displayName}DevicesHTTP();\n    devices.push(...httpDevices);\n  } catch (error) {\n    log('HTTP discovery failed:', error);\n  }\n` : ''}
  ${config.useMdns ? `// Try mDNS discovery\n  try {\n    const mdnsDevices = await discover${config.displayName}DevicesMDNS();\n    devices.push(...mdnsDevices);\n  } catch (error) {\n    log('mDNS discovery failed:', error);\n  }\n` : ''}

  return devices;
}
`;

  await writeFile(join(dir, 'discovery.ts'), content);
  console.log('   ✅ Created discovery.ts');
}

async function generateClient(
  dir: string,
  config: ProtocolConfig,
): Promise<void> {
  const content = `/**
 * ${config.displayName} Protocol Client
 */

import { EventEmitter } from 'node:events';
import { debug } from '@cove/logger';
import type {
  ${config.displayName}ClientOptions,
  ${config.displayName}Device,
  ${config.displayName}DeviceState,
} from './types';

const log = debug('cove:protocols:${config.name}:client');

export class ${config.displayName}Client extends EventEmitter {
  private options: ${config.displayName}ClientOptions;
  private connected = false;

  constructor(options: ${config.displayName}ClientOptions) {
    super();
    this.options = options;
    log(\`${config.displayName}Client initialized for \${options.host}:\${options.port || ${config.defaultPort}}\`);
  }

  /**
   * Connects to the ${config.displayName} device/hub
   */
  async connect(): Promise<void> {
    if (this.connected) {
      log('Already connected');
      return;
    }

    log(\`Connecting to ${config.displayName} device at \${this.options.host}:\${this.options.port || ${config.defaultPort}}\`);

    try {
      // TODO: Implement connection logic
      // Example for TCP: const socket = await tcpConnect({ host: this.options.host, port: this.options.port });
      // Example for HTTP: Validate endpoint is reachable

      this.connected = true;
      log('Connected successfully');
      this.emit('connected');
    } catch (error) {
      log('Connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnects from the ${config.displayName} device/hub
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      log('Not connected');
      return;
    }

    log('Disconnecting from ${config.displayName} device');

    try {
      // TODO: Implement disconnection logic
      // Example: socket.close();

      this.connected = false;
      log('Disconnected successfully');
      this.emit('disconnected');
    } catch (error) {
      log('Disconnection error:', error);
      throw error;
    }
  }

  /**
   * Checks if the client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Gets all devices
   */
  async getDevices(): Promise<${config.displayName}Device[]> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    log('Getting devices');

    // TODO: Implement device listing
    // Example: const response = await this.request('GET', '/devices');

    return [];
  }

  /**
   * Gets a specific device by ID
   */
  async getDevice(id: string): Promise<${config.displayName}Device> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    log(\`Getting device: \${id}\`);

    // TODO: Implement device retrieval
    // Example: const response = await this.request('GET', \`/devices/\${id}\`);

    throw new Error('Not implemented');
  }

  /**
   * Gets device state
   */
  async getDeviceState(id: string): Promise<${config.displayName}DeviceState> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    log(\`Getting device state: \${id}\`);

    // TODO: Implement state retrieval

    throw new Error('Not implemented');
  }

  /**
   * Sends a command to a device
   */
  async sendCommand(
    deviceId: string,
    command: string,
    value: unknown,
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    log(\`Sending command to device \${deviceId}: \${command} =\`, value);

    // TODO: Implement command sending
    // Example: await this.request('PUT', \`/devices/\${deviceId}/\${command}\`, { value });
  }

  // Add more protocol-specific methods here
}
`;

  await writeFile(join(dir, 'client.ts'), content);
  console.log('   ✅ Created client.ts');
}

async function generateIndex(
  dir: string,
  config: ProtocolConfig,
): Promise<void> {
  const content = `/**
 * ${config.displayName} Protocol
 *
 * ${config.description}
 */

export { ${config.displayName}Client } from './client';
export { discover${config.displayName}Devices${config.useMdns ? `, discover${config.displayName}DevicesMDNS, ${config.name.toUpperCase()}_MDNS_SERVICE_TYPE` : ''}${config.useHttp ? `, discover${config.displayName}DevicesHTTP` : ''} } from './discovery';
export type * from './types';
`;

  await writeFile(join(dir, 'index.ts'), content);
  console.log('   ✅ Created index.ts');
}

async function generateReadme(
  dir: string,
  config: ProtocolConfig,
): Promise<void> {
  const content = `# ${config.displayName} Protocol

${config.description}

## Features

- 🔍 Device discovery (${config.useMdns ? 'mDNS' : ''}${config.useMdns && config.useHttp ? ' + ' : ''}${config.useHttp ? 'HTTP' : ''})
- 🔌 Connection management
- 📡 Device control
- 📊 State monitoring

## Usage

### Discovery

\`\`\`typescript
import { discover${config.displayName}Devices } from '@cove/protocols/${config.name}';

const devices = await discover${config.displayName}Devices();
console.log('Found devices:', devices);
\`\`\`

### Client

\`\`\`typescript
import { ${config.displayName}Client } from '@cove/protocols/${config.name}';

const client = new ${config.displayName}Client({
  host: '192.168.1.100',
  port: ${config.defaultPort},
});

await client.connect();

// Get devices
const devices = await client.getDevices();

// Send commands
await client.sendCommand('device-id', 'turn_on', true);

await client.disconnect();
\`\`\`

### Events

\`\`\`typescript
client.on('connected', () => {
  console.log('Connected to ${config.displayName}');
});

client.on('disconnected', () => {
  console.log('Disconnected from ${config.displayName}');
});

// Add more event handlers for state changes, errors, etc.
\`\`\`

## API Reference

### ${config.displayName}Client

#### Constructor

\`\`\`typescript
new ${config.displayName}Client(options: ${config.displayName}ClientOptions)
\`\`\`

#### Methods

- \`connect(): Promise<void>\` - Connect to device/hub
- \`disconnect(): Promise<void>\` - Disconnect from device/hub
- \`isConnected(): boolean\` - Check connection status
- \`getDevices(): Promise<${config.displayName}Device[]>\` - Get all devices
- \`getDevice(id: string): Promise<${config.displayName}Device>\` - Get specific device
- \`getDeviceState(id: string): Promise<${config.displayName}DeviceState>\` - Get device state
- \`sendCommand(deviceId: string, command: string, value: unknown): Promise<void>\` - Send command

## Implementation Status

- [ ] Basic connection
- [ ] Device discovery
- [ ] Device listing
- [ ] State retrieval
- [ ] Command sending
- [ ] Real-time updates
- [ ] Error handling
- [ ] Tests

## TODO

1. Implement actual protocol communication
2. Add authentication if needed
3. Handle real-time state updates
4. Add comprehensive error handling
5. Write tests
6. Add integration with hub adapter

## References

- [Official ${config.displayName} Documentation](https://example.com)
- [Protocol Specification](https://example.com/spec)
`;

  await writeFile(join(dir, 'README.md'), content);
  console.log('   ✅ Created README.md');
}

async function generateTests(config: ProtocolConfig): Promise<void> {
  const testDir = join(process.cwd(), 'tests', config.name);

  // Client tests
  const clientTestContent = `import { describe, expect, it } from 'bun:test';
import { ${config.displayName}Client } from '../../src/${config.name}';

describe('${config.displayName}Client', () => {
  describe('Constructor', () => {
    it('should create a client instance', () => {
      const client = new ${config.displayName}Client({
        host: 'localhost',
        port: ${config.defaultPort},
      });

      expect(client).toBeDefined();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Connection', () => {
    it('should connect successfully', async () => {
      // TODO: Implement with mock device
    });

    it('should disconnect successfully', async () => {
      // TODO: Implement with mock device
    });
  });

  describe('Devices', () => {
    it('should get all devices', async () => {
      // TODO: Implement with mock device
    });

    it('should get specific device', async () => {
      // TODO: Implement with mock device
    });
  });

  describe('Commands', () => {
    it('should send commands', async () => {
      // TODO: Implement with mock device
    });
  });
});
`;

  await writeFile(join(testDir, 'client.test.ts'), clientTestContent);
  console.log('   ✅ Created tests/client.test.ts');

  // Discovery tests
  const discoveryTestContent = `import { describe, expect, it } from 'bun:test';
import { discover${config.displayName}Devices } from '../../src/${config.name}';

describe('${config.displayName} Discovery', () => {
  it('should discover devices', async () => {
    // TODO: Implement with mock devices
    const devices = await discover${config.displayName}Devices();
    expect(Array.isArray(devices)).toBe(true);
  });
});
`;

  await writeFile(join(testDir, 'discovery.test.ts'), discoveryTestContent);
  console.log('   ✅ Created tests/discovery.test.ts');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

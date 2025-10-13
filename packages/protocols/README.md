# @cove/protocols

Protocol implementations for the Cove home automation platform.

## Supported Protocols

### ESPHome ✅

Full custom implementation with two adapters:

- **Native API** (`@cove/protocols/esphome/native`) - TCP-based protocol on port 6053
  - Entity discovery (sensors, switches, lights, buttons, numbers)
  - Real-time state updates
  - Command support (switch, light, button, number)
  - Custom implementation (~900 lines, zero dependencies)

- **SSE** (`@cove/protocols/esphome/sse`) - HTTP Server-Sent Events
  - Read-only sensor data streaming
  - Lightweight alternative for monitoring

See `src/esphome/README.md` for detailed documentation.

### Philips Hue ✅

Full REST API implementation:

- **Bridge Discovery** - mDNS + HTTPS endpoint
- **Authentication** - Physical button pairing
- **Light Control** - On/off, brightness, color, temperature
- **Group Management** - Rooms, zones, multi-light control
- **Scene Support** - Activate, create, delete scenes
- **Zero Dependencies** - Pure Node.js implementation

See `src/hue/README.md` for detailed documentation.

## Planned Protocols

### Matter 🚧

Thread/WiFi mesh networking with HomeKit compatibility.

### Zigbee 🚧

Low-power mesh networking via Zigbee2MQTT or ZHA.

### MQTT 🚧

Generic MQTT broker support for custom integrations.

### HomeKit 🚧

Apple HomeKit Accessory Protocol (HAP).

### Z-Wave 🚧

Z-Wave JS integration for Z-Wave devices.

## Usage

### ESPHome

```typescript
import { ESPHomeNativeClient } from '@cove/protocols/esphome/native';

// Native API - full control
const client = new ESPHomeNativeClient({
  host: '192.168.0.22',
  port: 6053,
  password: '',
});

await client.connect();

client.on('sensorState', ({ entity, state }) => {
  console.log(`${entity.name}: ${state} ${entity.unitOfMeasurement}`);
});

// Send commands
await client.switchCommand(keyId, true);
await client.lightCommand(keyId, { state: true, brightness: 0.8 });
```

### Philips Hue

```typescript
import { HueClient, discoverBridgesHTTPS } from '@cove/protocols/hue';

// Discover bridges
const bridges = await discoverBridgesHTTPS();

// Create client
const client = new HueClient({
  host: bridges[0].internalipaddress,
  useHttps: true,
});

// Authenticate (press button first!)
const username = await client.authenticate();

// Connect and control
await client.connect();
await client.toggleLight('1', true);
await client.setBrightness('1', 200);
await client.setColor('1', 10000, 254);
```

## Quick Start

### Adding a New Protocol

Use the protocol scaffolding tool to quickly create a new protocol:

```bash
cd packages/protocols
bun run create:protocol <protocol-name>
```

Example:
```bash
bun run create:protocol zigbee
```

This creates:
- `src/zigbee/` - Protocol implementation
- `tests/zigbee/` - Test stubs
- All boilerplate files (types, client, discovery, README)

See `ADDING_PROTOCOLS.md` for detailed implementation guide.

### Verifying Hue Bridge Connection

Test your Hue bridge connectivity:

```bash
cd packages/protocols
bun run verify:hue
```

This will discover your bridge, authenticate (with button press), and test all functionality.

## Architecture

Each protocol implementation provides:

1. **Client** - Low-level protocol handler
2. **Adapter** - High-level interface conforming to `ProtocolAdapter`
3. **Types** - Protocol-specific type definitions

## Contributing

When adding a new protocol:

1. Create a directory under `src/`
2. Implement the `ProtocolAdapter` interface
3. Add comprehensive documentation
4. Include tests and examples


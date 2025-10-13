

# Philips Hue Protocol

REST API client for Philips Hue Bridge with zero external dependencies.

## Features

✅ **Bridge Discovery**
- mDNS discovery (`_hue._tcp`)
- HTTPS discovery endpoint
- Automatic local network detection

✅ **Authentication**
- Physical button press pairing
- Secure API key management
- Support for HTTPS (recommended)

✅ **Light Control**
- On/off toggle
- Brightness (0-254)
- Color (Hue/Saturation)
- Color temperature (mireds)
- XY color space
- Transition times
- Alert effects

✅ **Group Management**
- Rooms and zones
- Multi-light control
- Group state management

✅ **Scene Support**
- Activate scenes
- Create/delete scenes
- Group scenes

🚧 **Coming Soon**
- Event streaming (SSE - API v2)
- Sensors and rules
- Schedules
- Entertainment API

## Quick Start

### 1. Discover Bridges

```typescript
import { discoverBridgesHTTPS } from '@cove/protocols/hue';

// Discover via Philips HTTPS endpoint
const bridges = await discoverBridgesHTTPS();
console.log(bridges);
// [{ id: "001788fffe4b5a12", internalipaddress: "192.168.1.100" }]

// Or use mDNS (via @cove/discovery)
// Service type: _hue._tcp
```

### 2. Authenticate

```typescript
import { HueClient } from '@cove/protocols/hue';

const client = new HueClient({
  host: '192.168.1.100',
  useHttps: true, // Recommended (default)
});

// Press the physical button on your Hue Bridge, then:
const username = await client.authenticate('cove#hub');
console.log('API Key:', username);

// Save this username for future use!
// Next time, pass it in options:
const client2 = new HueClient({
  host: '192.168.1.100',
  username: 'your-saved-username',
});
```

### 3. Connect and Control

```typescript
await client.connect();

// Get all lights
const lights = await client.getLights();
console.log(lights);

// Turn light on
await client.toggleLight('1', true);

// Set brightness
await client.setBrightness('1', 200); // 0-254

// Set color
await client.setColor('1', 10000, 254); // hue: 0-65535, sat: 0-254

// Set color temperature
await client.setColorTemperature('1', 350); // 153-500 mireds

// Advanced state control
await client.setLightState('1', {
  on: true,
  bri: 200,
  hue: 10000,
  sat: 254,
  transitiontime: 10, // 1 second (10 * 100ms)
  alert: 'select', // Flash once
});
```

## Groups and Rooms

```typescript
// Get all groups
const groups = await client.getGroups();

// Control a group (room)
await client.setGroupState('1', {
  on: true,
  bri: 200,
});

// Create a new group
await client.createGroup('Living Room', ['1', '2', '3'], 'Room');

// Delete a group
await client.deleteGroup('5');
```

## Scenes

```typescript
// Get all scenes
const scenes = await client.getScenes();

// Activate a scene
await client.activateScene('scene-id');

// Activate scene in specific group
await client.activateScene('scene-id', 'group-id');

// Create a new scene
await client.createScene('Relax', ['1', '2', '3']);

// Delete a scene
await client.deleteScene('scene-id');
```

## Complete Example

```typescript
import { HueClient, discoverBridgesHTTPS } from '@cove/protocols/hue';

async function main() {
  // 1. Discover bridge
  const bridges = await discoverBridgesHTTPS();
  if (bridges.length === 0) {
    throw new Error('No Hue bridges found');
  }

  const bridge = bridges[0];
  console.log(`Found bridge: ${bridge.id} at ${bridge.internalipaddress}`);

  // 2. Create client
  const client = new HueClient({
    host: bridge.internalipaddress,
    useHttps: true,
  });

  // 3. Authenticate (first time only)
  console.log('Press the link button on your Hue Bridge...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const username = await client.authenticate();
  console.log('Authenticated! Save this username:', username);

  // 4. Connect
  await client.connect();

  // 5. Get all devices
  const lights = await client.getLights();
  console.log('Found lights:', Object.keys(lights).length);

  // 6. Control lights
  for (const [id, light] of Object.entries(lights)) {
    console.log(`Light ${id}: ${light.name} (${light.state.on ? 'ON' : 'OFF'})`);

    // Turn on with warm white
    await client.setLightState(id, {
      on: true,
      bri: 200,
      ct: 400,
      transitiontime: 10,
    });
  }

  // 7. Disconnect
  await client.disconnect();
}

main().catch(console.error);
```

## API Reference

### HueClient

#### Constructor Options

```typescript
interface HueClientOptions {
  host: string;          // Bridge IP address
  port?: number;         // Default: 443 (HTTPS) or 80 (HTTP)
  username?: string;     // API key (from authentication)
  timeout?: number;      // Request timeout (default: 5000ms)
  useHttps?: boolean;    // Use HTTPS (default: true, recommended)
}
```

#### Authentication

- `authenticate(devicetype?: string): Promise<string>` - Authenticate and get API key
- `connect(): Promise<void>` - Test connection to bridge
- `disconnect(): Promise<void>` - Disconnect from bridge
- `isConnected(): boolean` - Check connection status

#### Bridge Info

- `getBridgeConfig(): Promise<HueBridgeConfig>` - Get bridge configuration
- `getAll(): Promise<HueResources>` - Get all resources at once

#### Light Control

- `getLights(): Promise<Record<string, HueLight>>` - Get all lights
- `getLight(id): Promise<HueLight>` - Get specific light
- `setLightState(id, state): Promise<unknown>` - Set light state
- `toggleLight(id, on): Promise<unknown>` - Turn light on/off
- `setBrightness(id, bri): Promise<unknown>` - Set brightness (0-254)
- `setColor(id, hue, sat): Promise<unknown>` - Set color
- `setColorTemperature(id, ct): Promise<unknown>` - Set color temp (153-500)
- `setXY(id, x, y): Promise<unknown>` - Set XY color
- `renameLight(id, name): Promise<unknown>` - Rename light

#### Group Control

- `getGroups(): Promise<Record<string, HueGroup>>` - Get all groups
- `getGroup(id): Promise<HueGroup>` - Get specific group
- `setGroupState(id, state): Promise<unknown>` - Set group state
- `createGroup(name, lights, type): Promise<unknown>` - Create group
- `deleteGroup(id): Promise<unknown>` - Delete group

#### Scene Control

- `getScenes(): Promise<Record<string, HueScene>>` - Get all scenes
- `getScene(id): Promise<HueScene>` - Get specific scene
- `activateScene(sceneId, groupId?): Promise<unknown>` - Activate scene
- `createScene(name, lights, type): Promise<unknown>` - Create scene
- `deleteScene(id): Promise<unknown>` - Delete scene

### Discovery

- `discoverBridgesHTTPS(): Promise<HueBridgeDiscovery[]>` - Discover via HTTPS
- `getMDNSServiceType(): string` - Get mDNS service type (`_hue._tcp`)
- `isValidBridge(bridge): boolean` - Validate bridge data
- `getBridgeURL(bridge, useHttps): string` - Get bridge URL

## Light State Properties

```typescript
interface HueLightState {
  on: boolean;                        // On/off
  bri?: number;                       // Brightness (0-254)
  hue?: number;                       // Hue (0-65535)
  sat?: number;                       // Saturation (0-254)
  ct?: number;                        // Color temperature (153-500)
  xy?: [number, number];              // CIE color space
  alert?: 'none' | 'select' | 'lselect';
  effect?: 'none' | 'colorloop';
  transitiontime?: number;            // Deciseconds (10 = 1 sec)
}
```

## Color Modes

Hue supports three color modes:

1. **Hue/Saturation (hs)**
   - `hue`: 0-65535 (0=red, ~21845=green, ~43690=blue)
   - `sat`: 0-254 (0=white, 254=fully saturated)

2. **Color Temperature (ct)**
   - `ct`: 153-500 mireds (153=cool, 500=warm)
   - 153 = ~6500K, 500 = ~2000K

3. **XY Color Space (xy)**
   - `xy`: [x, y] coordinates (0.0-1.0)
   - CIE 1931 color space

## Error Handling

```typescript
try {
  await client.authenticate();
} catch (error) {
  if (error.message.includes('link button')) {
    console.log('Please press the link button on your bridge');
  } else {
    console.error('Authentication failed:', error);
  }
}
```

## HTTPS vs HTTP

**HTTPS** (Recommended):
- ✅ Secure communication
- ✅ Required for newer bridges
- ✅ Default in this implementation
- ⚠️ Self-signed certificate (expected for local network)

**HTTP** (Deprecated):
- ⚠️ Being phased out by Philips
- ⚠️ May not work on newer firmware
- ❌ Not secure

## Integration with Cove Hub

```typescript
import { HueClient } from '@cove/protocols/hue';
import type { Device } from '@cove/types';

// In your hub daemon
const device: Device = {
  id: 'hue-bridge-1',
  name: 'Hue Bridge',
  protocol: 'hue',
  ipAddress: '192.168.1.100',
  // ... other fields
};

const hueClient = new HueClient({
  host: device.ipAddress,
  username: device.config?.username as string,
});

await hueClient.connect();

// Listen for state changes (poll or use events)
const lights = await hueClient.getLights();
// Store in Supabase, emit to web app, etc.
```

## Resources

- [Official Hue API Documentation](https://developers.meethue.com/develop/hue-api/)
- [API v2 (CLIP API)](https://developers.meethue.com/develop/hue-api-v2/)
- [Hue Developer Program](https://developers.meethue.com/)

## License

MIT


# Example Usage - Cove Hub with ESPHome

This document shows how to use the ESPHome Native API client from `@cove/protocols`.

## Quick Start

```typescript
import { ESPHomeNativeClient } from '@cove/protocols/esphome/native';

// Connect to Apollo Air
const client = new ESPHomeNativeClient({
  host: '192.168.0.22',
  port: 6053,
  password: '', // optional
});

await client.connect();

// Listen for sensor updates
client.on('sensorState', ({ entity, state }) => {
  console.log(`${entity.name}: ${state} ${entity.unitOfMeasurement || ''}`);
});

// Get all entities
const entities = client.getEntities();
console.log(`Discovered ${entities.length} entities`);

// Send commands
const switchEntity = client.getEntityByName('My Switch');
if (switchEntity) {
  await client.switchCommand(switchEntity.key, true);
}

// Disconnect
await client.disconnect();
```

## SSE Adapter (Read-Only)

```typescript
import { ESPHomeSSEAdapter } from '@cove/protocols/esphome/sse';
import type { Device } from '@cove/types';

const adapter = new ESPHomeSSEAdapter();

const device: Device = {
  id: 'apollo-air-1',
  name: 'Apollo Air',
  ipAddress: '192.168.0.22',
  // ... other fields
};

await adapter.connect(device);
await adapter.subscribeToUpdates(device, (metric) => {
  console.log('Metric:', metric);
});

await adapter.disconnect(device);
```

## Integration with Hub Daemon

The hub daemon automatically discovers ESPHome devices via mDNS and connects to them:

```typescript
import { HubDaemon } from './daemon';

const daemon = new HubDaemon();
await daemon.start();

// Discovery will automatically find ESPHome devices
// and sync them to Supabase
```

See `packages/hub/src/daemon.ts` for the full implementation.


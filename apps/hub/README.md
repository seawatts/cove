# Cove Hub V2

A modern, high-performance home automation hub daemon built with TypeScript, Bun, and SQLite.

## Features

- **Simplified Architecture**: Clean separation of concerns with EventBus, Registry, StateStore, and CommandRouter
- **ESPHome Support**: Native ESPHome protocol driver with real-time entity discovery and control
- **SQLite Database**: Fast, embedded database with WAL mode for concurrent access
- **Real-time Events**: WebSocket streaming for live device state updates
- **Command Coalescing**: Intelligent batching of rapid commands (e.g., dimmer scrubs)
- **Rate Limiting**: Per-entity rate limiting to prevent command flooding
- **Bun 1.3**: Modern runtime with native WebSocket and routing support

## Architecture

### Core Components

- **EventBus**: In-process pub/sub messaging for real-time events
- **Registry**: Device and entity CRUD operations with fingerprint deduplication
- **StateStore**: Entity state snapshots and telemetry batching
- **CommandRouter**: Normalized command handling with retry and coalescing
- **DriverKit**: Simplified driver interface for protocol adapters

### Database Schema

The hub uses a local SQLite database for device-centric data only:

- **homes**: Home records with timezone and address
- **rooms**: Room organization within homes
- **devices**: Device records with protocol, vendor, and connection info
- **entities**: Entity records with capabilities and normalization
- **entity_state**: Latest state snapshots for fast UI updates
- **telemetry**: Timeseries data for sensors and analytics
- **credentials**: Encrypted device pairing credentials
- **alertConfigs**: Alert configuration for entity monitoring
- **alertHistory**: Alert trigger history

**Note:** User accounts and preferences are managed in the cloud Postgres database, not in the hub. The hub operates as a stateless device controller that can be accessed by multiple cloud users.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.3 or later
- Node.js 18+ (for development)

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build production binary
bun run build
```

### Configuration

Environment variables:

- `DB_PATH`: Database file path (default: `./data/hub.db`)
- `HUB_ID`: Unique hub identifier (auto-generated if not set)
- `PORT`: HTTP server port (default: 3200)
- `NODE_ENV`: Environment (development/production/test)

## API

### HTTP Endpoints

- `GET /` - Hub status and version
- `GET /health` - Health check with component status
- `GET /devices?homeId=<id>` - List devices by home
- `GET /entities?homeId=<id>&roomId=<id>&kind=<type>` - Query entities
- `GET /entities/:id` - Get entity details and current state
- `POST /entities/:id/commands` - Send command to entity
- `GET /telemetry?entityId=<id>&field=<field>&from=<date>&to=<date>` - Query telemetry
- `POST /pair/:deviceId` - Pair device with credentials

### WebSocket

Connect to `/events` for real-time event streaming:

```javascript
const ws = new WebSocket('ws://localhost:3200/events');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message.type, message.data);
};

// Subscribe to specific topics
ws.send(JSON.stringify({
  type: 'subscribe',
  topics: ['entity/*/state', 'telemetry']
}));
```

## Device Pairing

### ESPHome Devices

1. Ensure ESPHome device is on the network
2. POST to `/pair/:deviceId` with credentials:

```json
{
  "protocol": "esphome",
  "address": "192.168.1.100",
  "password": "optional_password"
}
```

3. Device will be discovered and entities enumerated automatically

## Development

### Project Structure

```
src/
├── api/           # HTTP routes and WebSocket handlers
├── core/          # Core components (EventBus, Registry, etc.)
├── db/            # Database schema and client
├── drivers/       # Protocol drivers (ESPHome, etc.)
├── daemon.ts      # Main daemon orchestration
├── env.ts         # Environment configuration
└── index.ts       # Entry point
```

### Adding New Drivers

1. Implement the `Driver` interface in `src/core/driver-kit.ts`
2. Add driver to `src/daemon.ts` initialization
3. Register driver in the `DriverRegistry`

### Testing

```bash
# Run tests
bun test

# Run tests with coverage
bun test --coverage
```

## Performance

- **Command Latency**: <50ms for local commands
- **Telemetry Throughput**: 1000+ records/second with batching
- **Memory Usage**: <100MB typical footprint
- **Database**: SQLite WAL mode for concurrent reads/writes

## User Management & Authentication

### Cloud vs Hub Architecture

The Cove system uses a hybrid architecture where user management happens entirely in the cloud:

**Cloud (Postgres):**
- User accounts (synced from Clerk authentication)
- User preferences (UI settings, tooltips, etc.)
- Home ownership and access control
- Multi-user access to hubs

**Hub (SQLite):**
- Device-centric data only
- No user accounts or authentication
- Can be accessed by multiple cloud users
- Authentication handled via API keys/tokens (when accessing directly)

This separation allows:
- Multiple cloud users to control the same hub (family sharing)
- Hub to operate independently without user identity concerns
- User preferences to be UI-only without affecting hub behavior

## Differences from Hub V1

1. **Simplified Driver Interface**: Single `Driver` interface replaces complex adapter hierarchy
2. **SQLite Schema**: Device/entity tables redesigned; users removed (managed in cloud only)
3. **EventBus Pattern**: Explicit pub/sub instead of StateManager broadcasts
4. **Bun 1.3 Routes**: Type-safe route objects instead of manual path matching
5. **No Discovery Package**: Manual device pairing for better control
6. **Functional Patterns**: Minimal use of classes per cursor rules

## License

MIT


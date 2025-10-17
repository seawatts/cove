# @cove/hub - Cove Hub Daemon

Core daemon for Cove home automation platform. Runs on Raspberry Pi using Bun runtime with **Home Assistant++ entity-first architecture**.

## Features

- **Entity Discovery**: Automatic discovery of entities within devices (sensors, lights, switches)
- **Protocol Support**: ESPHome, Hue, Matter, Zigbee, and more
- **Drizzle ORM**: Type-safe database operations with PostgreSQL/TimescaleDB
- **Entity State History**: Efficient time-series storage for entity state history
- **Home-Centric Architecture**: Multi-home support with proper isolation
- **Health Monitoring**: `/health` and `/info` endpoints
- **WebSocket API**: Real-time entity state updates
- **Standalone Binary**: Compiles to single executable

## Quick Start

### Development

```bash
# Run with hot reload
bun dev

# Or from repo root
bun dev:hub
```

### Build

```bash
# Build for current platform
bun run build

# Build for Raspberry Pi (ARM64)
bun run build:linux-arm64

# Build for all platforms
bun run build:linux-x64
bun run build:darwin-arm64
bun run build:darwin-x64
```

### Test

```bash
bun test
```

## Environment Variables

Create a `.env` file with:

```bash
# Hub Configuration
HUB_ID=hub_my_home
HUB_NAME=My Cove Hub
HUB_VERSION=0.1.0

# Server
PORT=3100
HOST=0.0.0.0

# Database (PostgreSQL/TimescaleDB)
DATABASE_URL=postgresql://user:password@localhost:5432/cove_hub
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=cove_hub
DATABASE_USER=user
DATABASE_PASSWORD=password

# Supabase (for Realtime subscriptions)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Discovery
DISCOVERY_ENABLED=true
DISCOVERY_INTERVAL=300

# Telemetry
TELEMETRY_INTERVAL=30

# Environment
NODE_ENV=development
```

## API Endpoints

### Health Check
```bash
GET /health
```

Returns:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 3600,
  "components": {
    "database": "ok",
    "discovery": "ok",
    "adapters": "ok"
  },
  "stats": {
    "devicesConnected": 5,
    "devicesOnline": 4,
    "entitiesDiscovered": 25,
    "messagesProcessed": 1234,
    "queueLag": 0
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### System Info
```bash
GET /info
```

Returns system information (platform, arch, memory, etc.)

### WebSocket
```bash
ws://localhost:3100/
```

Real-time device state updates and command handling.

## ESPHome Entity-Aware Integration

The hub connects to ESPHome devices using the **Native API** and discovers entities within each device.

### Entity Discovery Flow

1. **Device Discovery**: mDNS finds ESPHome device (`_esphomelib._tcp.local.`)
2. **Connect**: TCP connection to `device_ip:6053`
3. **Hello**: Send `HelloRequest` with client info
4. **Authenticate**: Send `ConnectRequest` with optional password
5. **List Entities**: Request entity list (`ListEntitiesRequest`)
6. **Create Entities**: Create entity records in database for each discovered entity
7. **Subscribe**: Subscribe to entity state updates via `SubscribeStatesRequest`
8. **Control**: Send entity commands (`SwitchCommandRequest`, `LightCommandRequest`, etc.)

### Apollo Air Integration

For Apollo Air CO₂ sensors:
1. Device discovered via mDNS (`_esphomelib._tcp.local.`)
2. Connect to device IP on port 6053
3. List entities to find CO₂, temperature, humidity sensors
4. Create entity records for each sensor
5. Subscribe to entity state updates
6. Stream entity state history to TimescaleDB

### Protobuf Implementation

Currently using placeholder implementation. To fully implement:

```bash
# Install protobuf library
bun add @bufbuild/protobuf

# Download ESPHome proto files
curl -o src/protocols/esphome/api.proto \
  https://raw.githubusercontent.com/esphome/aioesphomeapi/main/aioesphomeapi/api_protobuf/api.proto

# Generate TypeScript types (using buf or protoc)
```

See `src/protocols/esphome-native-api.ts` for detailed protocol documentation.

## Architecture

```
HubDaemon
├── DiscoveryManager
│   └── MDNSDiscoveryService (discovers devices)
├── StateManager (entity-first state management)
├── HubDatabase (Drizzle ORM database layer)
├── CommandProcessor (entity command handling)
├── DeviceEventCollector (event logging)
├── DeviceMetricsCollector (hub metrics as sensor entities)
└── Protocol Adapters
    ├── ESPHomeAdapter (Entity-aware Native API)
    ├── HueAdapter (Entity-aware Hue API)
    ├── MatterAdapter (future)
    └── ZigbeeAdapter (future)
```

### Home Assistant++ Entity-First Design

The hub uses a **Home Assistant++ entity-first architecture**:

1. **Device Discovery**: mDNS scanning finds devices
2. **Entity Discovery**: Adapters discover entities within devices
3. **Entity Creation**: Entities created in database with traits and capabilities
4. **State Management**: Entity states managed separately from devices
5. **Command Processing**: Commands target specific entities
6. **State History**: TimescaleDB stores entity state history efficiently
7. **Home-Centric**: Multi-home support with proper isolation

### Database Schema Alignment

The hub now uses the standardized schema from `@cove/db`:

- **`home`**: Home instances with timezone and address
- **`device`**: Physical devices (hub, sensors, lights, etc.)
- **`entity`**: Logical entities within devices (sensors, lights, switches)
- **`entityState`**: Current state of each entity
- **`entityStateHistory`**: Time-series history of entity state changes
- **`event`**: System events and logs
- **`eventType`**: Event type definitions
- **`eventPayload`**: Event payload data

### Metrics as Sensor Entities

Hub metrics are now stored as sensor entities following Home Assistant patterns:

- **CPU Usage**: `sensor.hub_cpu_usage` (%)
- **Memory Usage**: `sensor.hub_memory_used` (MB)
- **Memory Total**: `sensor.hub_memory_total` (MB)
- **Memory Free**: `sensor.hub_memory_free` (MB)
- **Memory Percent**: `sensor.hub_memory_percent` (%)
- **Uptime**: `sensor.hub_uptime` (seconds)
- **Connected Devices**: `sensor.hub_connected_devices` (count)
- **Active Protocols**: `sensor.hub_active_protocols` (count)

Each metric is stored as both current state and state history, enabling time-series analysis and monitoring.

### Migration from SupabaseSync

The hub has been migrated from the old `SupabaseSync` architecture to the new `HubDatabase` layer:

- **Drizzle ORM**: Type-safe database operations replacing raw Supabase client calls
- **Schema Alignment**: All table names and field names now match `@cove/db/schema.ts`
- **Home-Centric**: Removed organization/user-centric references, now uses home-based organization
- **Entity-First**: All state management now revolves around entities rather than devices
- **Type Safety**: Proper TypeScript types throughout using `@cove/db/types`

### Missing Schema Elements

Some schema elements are documented in `SCHEMA_TODO.md` and will be added in future iterations:

- **`commands` table**: For entity command processing and queuing
- **`protocol` field**: On device table for protocol identification
- **Additional entity traits**: For automation and advanced capabilities

## Development Notes

- Uses Bun's built-in WebSocket support (no ws library needed)
- Bun.serve provides HTTP + WebSocket in one
- Compiles to standalone binary (no Node.js required on Pi)
- Hot reload during development
- Test coverage for core functionality

## Deployment

### Raspberry Pi

1. Build binary: `bun run build:linux-arm64`
2. Copy `cove-hub-linux-arm64` to Pi
3. Create systemd service:

```ini
[Unit]
Description=Cove Hub
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cove-hub
Restart=always
RestartSec=10
Environment="HUB_ID=hub_pi"
EnvironmentFile=/etc/cove/hub.env

[Install]
WantedBy=multi-user.target
```

4. Enable and start:
```bash
sudo systemctl enable cove-hub
sudo systemctl start cove-hub
```

## License

MIT


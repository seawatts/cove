# @cove/hub - Cove Hub Daemon

Core daemon for Cove home automation platform. Runs on Raspberry Pi using Bun runtime.

## Features

- **Device Discovery**: Automatic mDNS scanning for smart home devices
- **Protocol Support**: ESPHome, Matter, Zigbee, and more
- **Cloud Sync**: Optional Supabase integration for remote access
- **Health Monitoring**: `/health` and `/info` endpoints
- **WebSocket API**: Real-time device state updates
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

# Supabase
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
    "supabase": "ok",
    "discovery": "ok"
  },
  "stats": {
    "devicesConnected": 5,
    "devicesOnline": 4,
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

## ESPHome Native API

The hub connects to ESPHome devices using the **Native API** which uses Protocol Buffers over TCP (port 6053).

### Protocol Flow

1. **Connect**: TCP connection to `device_ip:6053`
2. **Hello**: Send `HelloRequest` with client info
3. **Authenticate**: Send `ConnectRequest` with optional password
4. **Subscribe**: Subscribe to state updates via `SubscribeStatesRequest`
5. **Control**: Send commands (`SwitchCommandRequest`, `LightCommandRequest`, etc.)

### Apollo Air Integration

For Apollo Air CO₂ sensors:
1. Device discovered via mDNS (`_esphomelib._tcp.local.`)
2. Connect to device IP on port 6053
3. List entities to find CO₂, temperature, humidity sensors
4. Subscribe to sensor state updates
5. Stream metrics to `device_metrics` table

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
├── SupabaseSync (cloud sync)
└── Protocol Adapters
    ├── ESPHomeAdapter (Native API via protobuf)
    ├── MatterAdapter (future)
    └── ZigbeeAdapter (future)
```

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


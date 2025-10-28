# Cove - Modern Home Assistant Alternative

> A self-hosted home automation platform that combines the power of Home Assistant with modern web technologies and automatic device discovery

## What is Cove?

Cove is a **modern, self-hosted alternative to Home Assistant** that brings together:

- **🚀 Hub Daemon**: Lightweight Bun-powered daemon that runs on Raspberry Pi or any Linux device
- **🔍 Automatic Discovery**: mDNS-based device discovery (no manual configuration needed)
- **🏗️ Entity-First Architecture**: Home Assistant-inspired but modernized with TypeScript
- **💎 Beautiful UI**: Next.js 15 web app with real-time updates and modern design
- **🔌 Multi-Protocol**: ESPHome, Philips Hue, with Matter/Zigbee coming soon
- **🏠 Self-Hosted**: Your data stays on your hardware (with optional cloud sync)
- **⚡ Developer-Friendly**: TypeScript throughout, modern tooling with Bun

## Cove vs Home Assistant

| Feature | Cove | Home Assistant |
|---------|------|----------------|
| **Runtime** | Bun (fast, modern) | Python (slower startup) |
| **UI Framework** | Next.js 15 + React 19 | Custom Python web framework |
| **Database** | PostgreSQL + TimescaleDB | SQLite (limited scalability) |
| **Device Discovery** | Automatic mDNS scanning | Manual configuration |
| **Mobile Apps** | Native iOS + React Native | Companion apps |
| **Development** | TypeScript monorepo | Python + YAML |
| **Performance** | Sub-second startup | 30+ second startup |
| **Entity Architecture** | Modernized HA patterns | Legacy patterns |

## Architecture

Cove uses a **Home Assistant-inspired entity-first architecture** with modern improvements:

### Hub Daemon (Raspberry Pi / Linux)
- **Bun Runtime**: Fast, modern TypeScript execution (sub-second startup)
- **Hub V2 Architecture**: Simplified, event-driven architecture with EventBus, Registry, StateStore, and CommandRouter
- **Entity Discovery**: Automatic discovery of entities within devices (sensors, lights, switches)
- **Protocol Support**: ESPHome, Hue, Matter, Zigbee, and more
- **SQLite Database**: In-memory SQLite with WAL mode for fast entity state snapshots and telemetry
- **Local API**: WebSocket and REST for real-time entity control
- **Standalone Binary**: Compiles to single executable (no Node.js required)
- **Integration Tests**: Comprehensive test suite with mock drivers for reliable testing

### Web Application
- **Next.js 15 PWA**: Modern React 19 with server-side rendering
- **Real-time Updates**: WebSocket connections for instant state changes
- **Entity Management**: Beautiful UI for controlling all your devices
- **Mobile Responsive**: Works perfectly on phones and tablets
- **Offline Support**: PWA capabilities for offline device control

### Cloud (Optional)
- **Entity Sync**: Keep entity states synchronized across clients
- **User Management**: Secure authentication with Clerk
- **Real-time Updates**: Instant entity state changes
- **Works Offline**: Cloud enhances experience but isn't required

### Mobile Apps
- **iOS App**: Native Swift application with widgets and HomeKit integration
- **Android App**: React Native (coming soon)

## Quick Start

### 1. Install Dependencies
```bash
bun install
```

### 2. Environment Setup
```bash
# Configure your Supabase and Clerk credentials
# See apps/hub/src/env.ts for all required environment variables
bun db:push
```

### 3. Start Development

#### Run the Hub Daemon
```bash
bun dev:hub
```

#### Run the Web App
```bash
bun dev:next
```

## Project Structure

```
apps/
  web-app/          # Next.js 15 PWA control panel
  hub/              # Core hub daemon (Bun runtime)
  hub-v2/           # Hub V2 daemon - simplified architecture
  expo/             # React Native mobile app (future)
  ios/              # Native iOS app with widgets

packages/
  db/               # Drizzle ORM + TimescaleDB schemas
  api/              # tRPC API layer (entity-focused)
  protocols/        # ESPHome, Hue, Matter adapters
  types/            # Shared TypeScript types (entity-first)
  discovery/        # mDNS device discovery
  ui/               # shadcn/ui components
  ai/               # BAML-powered AI functions
  analytics/        # PostHog integration & metrics
  email/            # Email templates with React Email
  logger/           # Structured logging
  id/               # ID generation utilities
  utils/            # Utility functions
  zustand/          # State management helpers
  integ-test/       # Integration test utilities
```

## Supported Devices & Protocols

### Current Support ✅
- **ESPHome**: Full native API support with entity discovery
- **Philips Hue**: Complete REST API implementation
- **mDNS Discovery**: Automatic device scanning and registration

### In Development 🚧
- **Matter**: Thread/WiFi mesh networking
- **Zigbee**: Low-power mesh networking
- **Z-Wave**: Z-Wave JS integration
- **HomeKit**: Apple HomeKit Accessory Protocol

### Device Types
- Lights (on/off, brightness, color, temperature)
- Switches and outlets
- Sensors (temperature, humidity, motion, CO₂)
- Thermostats
- Locks
- Cameras (streaming)
- Speakers and media players

## Development Commands

### Hub Development
```bash
bun dev:hub              # Start hub daemon with hot reload
bun build:hub            # Build hub for deployment
bun build:hub:linux-arm64 # Build for Raspberry Pi
```

### Database
```bash
bun db:studio            # Open Drizzle Studio
bun db:push              # Push schema changes
bun db:gen-migration     # Generate migration
bun db:migrate           # Run migrations
```

### Code Quality
```bash
bun format:fix           # Format code with Biome
bun typecheck            # Type check all packages
bun test                 # Run tests with Bun
bun test:integ           # Run integration tests
```

### Hub V2 Testing
```bash
cd apps/hub-v2
bun test                 # Run Hub V2 integration tests
bun test:watch           # Watch mode for tests
bun test:coverage        # Run with coverage report
```

The Hub V2 integration tests cover:
- Daemon lifecycle (initialization, running state, shutdown)
- Device discovery and pairing workflows
- Event bus and state management
- Mock ESPHome driver for hardware-free testing
- In-memory SQLite for fast, isolated test execution

## Deployment

### Hub (Raspberry Pi / Linux)

1. Build the hub daemon:
   ```bash
   bun build:hub:linux-arm64
   ```

2. Copy `cove-hub-linux-arm64` to your Raspberry Pi

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

### Web App (Vercel)
```bash
vercel --prod
```

### iOS App (App Store)
```bash
# Build and deploy via Xcode
# TestFlight for beta testing
```

## Technology Stack

- **Runtime**: Bun 1.3.0 (hub daemon)
- **Framework**: Next.js 15.5.5, React 19.2.0
- **Database**: Supabase (PostgreSQL + Realtime) + TimescaleDB
- **ORM**: Drizzle 0.44.6
- **API**: tRPC v11
- **Auth**: Clerk
- **UI**: shadcn/ui + Tailwind CSS 4.1.14
- **Analytics**: PostHog + Vercel Analytics
- **AI**: BAML (Boundary ML) with OpenAI GPT-4o
- **Mobile**: React Native (Expo) + Native iOS Swift
- **Monorepo**: Turborepo + Bun workspaces

## Roadmap

### Phase 1 (Current) ✅
- [x] Project structure and architecture
- [x] Entity-first database schemas (TimescaleDB)
- [x] Hub daemon core with entity discovery
- [x] mDNS discovery
- [x] ESPHome integration (entity-aware)
- [x] Hue integration (entity-aware)
- [x] Web UI with entity display
- [x] Entity state history and widgets
- [x] iOS app with widgets
- [x] Analytics and monitoring
- [x] Hub V2 with simplified architecture
- [x] Hub V2 integration tests

### Phase 2 (In Progress)
- [ ] Device control UI improvements
- [ ] Hub pairing flow
- [ ] Real-time updates optimization
- [ ] Raspberry Pi image creation
- [ ] Android app development

### Phase 3 (Future)
- [ ] Matter protocol support
- [ ] Zigbee integration
- [ ] Automation engine
- [ ] Scene management
- [ ] Voice control

### Phase 4 (Future)
- [ ] Advanced automations
- [ ] Community integrations
- [ ] Plugin system
- [ ] Enterprise features

## Contributing

We welcome contributions! Cove is designed to be extensible:

1. **New Device Protocols**: Implement the `ProtocolAdapter` interface
2. **Device Adapters**: Add support for specific device types
3. **UI Components**: Contribute to the component library
4. **Documentation**: Help others get started

## License

MIT

## Community

- **Documentation**: Coming soon
- **Discord**: Coming soon
- **GitHub Discussions**: Open an issue or discussion

---

Built with ❤️ for the smart home community
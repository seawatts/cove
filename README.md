# Cove - Self-Hosted Home Automation Platform

> Combining the simplicity of Google Home with the extensibility of Home Assistant

## What is Cove?

Cove is a modern, self-hosted home automation platform that brings together:

- **Simple Setup**: HomeKit-style onboarding and intuitive device pairing
- **Powerful Control**: Beautiful web and mobile interfaces for all your devices
- **Full Customization**: Matter, Zigbee, ESPHome, and custom integrations
- **Privacy First**: Runs on your own hardware with optional cloud sync

## Architecture

### Hub (Raspberry Pi)
- **Bun Runtime**: Fast, modern TypeScript execution
- **Device Discovery**: Automatic mDNS scanning for compatible devices
- **Protocol Support**: ESPHome, Matter, Zigbee, Z-Wave, and more
- **Local API**: WebSocket and REST for real-time control

### Cloud (Supabase)
- **Device Sync**: Keep device states synchronized across clients
- **User Management**: Secure authentication with Clerk
- **Real-time Updates**: Instant device state changes
- **Optional**: Works offline, cloud enhances experience

### Apps
- **Web PWA** (`apps/web-app`): Next.js 15 control panel
- **iOS App** (`apps/ios`): Native Swift application
- **Mobile** (`apps/expo`): React Native for Android (coming soon)

## Quick Start

### 1. Install Dependencies
```bash
bun install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Configure your Supabase and Clerk credentials
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
  expo/             # React Native mobile app (future)
  ios/              # Native iOS app

packages/
  hub/              # Core hub daemon (Bun runtime)
  device-protocols/ # ESPHome, Matter, Zigbee adapters
  discovery/        # mDNS device discovery
  types/            # Shared TypeScript types
  db/               # Drizzle ORM + Supabase schemas
  api/              # tRPC API layer
  ui/               # shadcn/ui components
```

## Supported Devices

### Current Support
- ✅ **ESPHome**: Full native API support
- ✅ **mDNS Discovery**: Automatic device scanning
- 🚧 **Matter**: In development
- 🚧 **Zigbee**: In development

### Device Types
- Lights (on/off, brightness, color)
- Switches and outlets
- Sensors (temperature, humidity, motion, CO₂)
- Thermostats
- Locks
- Cameras (streaming)
- Speakers and media players

## Development Commands

### Hub Development
```bash
bun dev:hub              # Start hub daemon
bun build:hub            # Build hub for deployment
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
bun test                 # Run tests
bun test:integ           # Run integration tests
```

## Deployment

### Hub (Raspberry Pi)
1. Build the hub daemon:
   ```bash
   bun build:hub
   ```
2. Deploy to Raspberry Pi (instructions coming soon)

### Web App (Vercel)
```bash
vercel --prod
```

## Roadmap

### Phase 1 (Current)
- [x] Project structure and architecture
- [x] Database schemas
- [ ] Hub daemon core
- [ ] mDNS discovery
- [ ] ESPHome integration
- [ ] Web UI basics

### Phase 2
- [ ] Device control UI
- [ ] Hub pairing flow
- [ ] Real-time updates
- [ ] Raspberry Pi image

### Phase 3
- [ ] Matter protocol support
- [ ] Zigbee integration
- [ ] Automation engine
- [ ] Scene management

### Phase 4
- [ ] Voice control
- [ ] Mobile apps
- [ ] Advanced automations
- [ ] Community integrations

## Technology Stack

- **Runtime**: Bun (hub daemon)
- **Framework**: Next.js 15, React 19
- **Database**: Supabase (PostgreSQL + Realtime)
- **ORM**: Drizzle
- **API**: tRPC v11
- **Auth**: Clerk
- **UI**: shadcn/ui + Tailwind CSS
- **Monorepo**: Turborepo + Bun workspaces

## Contributing

We welcome contributions! Cove is designed to be extensible:

1. **New Device Protocols**: Implement the `DeviceProtocol` interface
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

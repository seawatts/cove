# @cove/hub-core

Core hub engine for Cove home automation platform.

## Overview

This package contains the main hub daemon and core services:

- **HubDaemon**: Main orchestration class for the hub
- **Registry**: Device and entity registry
- **StateStore**: State management and telemetry storage
- **CommandRouter**: Command processing and routing
- **AlertService**: Alert management and monitoring
- **EventBus**: Event system for inter-component communication

## Usage

```typescript
import { HubDaemon } from '@cove/hub-core';

const daemon = new HubDaemon({
  dbPath: './data/hub.db',
  hubId: 'hub_abc123'
});

await daemon.initialize();
await daemon.start();
```

## Architecture

The hub core follows a modular architecture where:
- Each service is independent and communicates via the EventBus
- The daemon orchestrates all services and worker loops
- Drivers are loaded from the `@cove/drivers` package
- Database operations use `@cove/db/hub` for the local SQLite database


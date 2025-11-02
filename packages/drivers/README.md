# @cove/drivers

Protocol drivers for Cove home automation platform.

## Overview

This package contains driver implementations for various IoT protocols and devices:

- **ESPHome**: Driver for ESPHome devices
- **Driver Kit**: Base interfaces and abstractions for creating drivers
- **Driver Loader**: Automatic driver discovery and loading

## Usage

```typescript
import { DriverLoader, SimpleDriverRegistry } from '@cove/drivers';

const driverRegistry = new SimpleDriverRegistry();
await DriverLoader.loadDrivers(driverRegistry);
```

## Adding New Drivers

To add a new driver:

1. Create a new directory under `src/` with your protocol name
2. Implement the `Driver` interface from `driver-kit.ts`
3. Export your driver from `src/index.ts`
4. Driver will be auto-loaded by the `DriverLoader`


<!-- bb11fd2a-65db-4929-a583-4eb3754d84d2 2f54c2b9-a4af-447f-9b18-eff914e64b8a -->
# Format Protocols Package

## Goal

Run `bun biome check --write` on the `packages/protocols` directory to automatically fix all formatting and linting issues according to the project's Biome configuration, while ensuring the ESPHome TypeScript implementation properly mirrors the reference JavaScript implementation from `.tmp/esphome-native-api`.

## Implementation

### Step 1: Verify ESPHome Implementation Mirrors Reference

Before formatting, verify that the TypeScript implementation in `packages/protocols/src/esphome/` properly mirrors the reference JavaScript implementation in `.tmp/esphome-native-api/`:

- Compare entity implementations (Base, BinarySensor, Button, Light, Number, Sensor, Switch)
- Compare connection.ts with connection.js
- Compare client.ts with client.js
- Identify any missing entities (Camera, Climate, Cover, Fan, Lock, MediaPlayer, Select, Siren, Text, TextSensor)
- Ensure TypeScript types properly represent the JavaScript API

### Step 2: Run Biome Format & Fix

Execute the Biome formatter and linter with the `--write` flag to automatically fix all issues in the protocols package:

- Command: `bun biome check --write packages/protocols`
- This will:
- Format all TypeScript files according to biome.json rules
- Fix auto-fixable linting issues (e.g., unused imports, style issues)
- Organize imports
- Sort attributes, keys, and properties
- Apply consistent code style (quotes, semicolons, trailing commas)

### Step 3: Verify Results

Review the output to ensure:

- All files were processed successfully
- Any remaining unfixable issues are identified
- No breaking changes were introduced
- Implementation still matches the reference API

## Files Affected

All TypeScript files in `packages/protocols/src/`:

- ESPHome protocol implementation (connection.ts, client.ts, entities/*, utils/*)
- Hue protocol implementation (client.ts, discovery.ts, types.ts)
- Other protocol stubs (homekit, matter, mqtt, zigbee, zwave)
- Index files and type definitions

## Reference Implementation

JavaScript reference in `.tmp/esphome-native-api/lib/`:

- entities/Base.js, BinarySensor.js, Button.js, Camera.js, Climate.js, Cover.js, Fan.js, Light.js, Lock.js, MediaPlayer.js, Number.js, Select.js, Sensor.js, Siren.js, Switch.js, Text.js, TextSensor.js
- connection.js, client.js, discovery.js
- utils/frameHelper.js, messages.js, etc.
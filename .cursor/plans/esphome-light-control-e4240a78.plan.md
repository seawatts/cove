<!-- e4240a78-a6d1-4387-9c6e-3b618c4989de fb27ab05-2700-4a27-b104-2b334b44920d -->
# Complete ESPHome Native API Protobuf Implementation

## Overview

Fix the ESPHome Native API implementation by properly implementing protobuf message parsing using protobuf-ts, creating entity classes, and matching the reference library's message handling architecture.

## Root Cause Analysis

1. **Message Parsing Incomplete**: Stub functions in `messages.ts` don't actually parse protobuf messages
2. **Missing Entity Classes**: No entity class structure like the reference library has
3. **Missing Message Type Mapping**: No system to route incoming protobuf messages to proper handlers
4. **Entity Discovery Broken**: Connection receives messages but doesn't parse entity list responses
5. **Connection Not Stored**: Entities created but connection reference not properly maintained in adapter

## Implementation Plan

### Phase 1: Create Entity Class Infrastructure

**Create directory: `packages/protocols/src/esphome/entities/`**

This will match the reference library's architecture where each entity type has its own class.

**File: `packages/protocols/src/esphome/entities/base.ts`**

- Create abstract `BaseEntity` class with:
- `connection: ESPHomeNativeClient` reference
- `config: any` (parsed entity config from ListEntities response)
- `state: any` (current state from state responses)
- Abstract static method `getListEntitiesResponseName(): string` to map to protobuf message types
- `updateState(newState: any): void` to update internal state
- Reference: `.tmp/esphome-native-api/lib/entities/Base.js`

**File: `packages/protocols/src/esphome/entities/light.ts`**

- Create `LightEntity` extends `BaseEntity`
- Add typed `config` property matching `ListEntitiesLightResponse` structure
- Add typed `state` property matching `LightStateResponse` structure
- Implement command methods:
- `setState(state: boolean): Promise<void>`
- `setBrightness(brightness: number): Promise<void>` (0.0-1.0)
- `setRgb(r: number, g: number, b: number): Promise<void>` (0.0-1.0 each)
- `setColorTemperature(temp: number): Promise<void>`
- `setEffect(effect: string): Promise<void>`
- Private `command(params: Partial<LightCommand>): Promise<void>` that calls client.lightCommand()
- Reference: `.tmp/esphome-native-api/lib/entities/Light.js`

**File: `packages/protocols/src/esphome/entities/switch.ts`**

- Create `SwitchEntity` extends `BaseEntity`
- Add typed config/state properties
- Implement `setState(state: boolean): Promise<void>`
- Reference: `.tmp/esphome-native-api/lib/entities/Switch.js`

**File: `packages/protocols/src/esphome/entities/sensor.ts`**

- Create `SensorEntity` extends `BaseEntity` (read-only, no commands)
- Reference: `.tmp/esphome-native-api/lib/entities/Sensor.js`

**File: `packages/protocols/src/esphome/entities/button.ts`**

- Create `ButtonEntity` extends `BaseEntity`
- Implement `press(): Promise<void>`
- Reference: `.tmp/esphome-native-api/lib/entities/Button.js`

**File: `packages/protocols/src/esphome/entities/number.ts`**

- Create `NumberEntity` extends `BaseEntity`
- Implement `setState(value: number): Promise<void>`
- Reference: `.tmp/esphome-native-api/lib/entities/Number.js`

**Files for remaining entity types:**

- `binary-sensor.ts` (read-only) - ref: BinarySensor.js
- `climate.ts` (temperature, mode, fan) - ref: Climate.js
- `cover.ts` (open/close/stop/position) - ref: Cover.js
- `fan.ts` (on/off/speed) - ref: Fan.js
- `select.ts` (set option) - ref: Select.js
- `text-sensor.ts` (read-only) - ref: TextSensor.js
- `text.ts` (set text) - ref: Text.js

**File: `packages/protocols/src/esphome/entities/index.ts`**

- Export factory function `createEntity(className: string, connection: ESPHomeNativeClient, config: any): BaseEntity`
- Map entity class names to constructors
- Export all entity classes
- Reference: `.tmp/esphome-native-api/lib/entities/index.js`

### Phase 2: Fix Protobuf Message Parsing

**File: `packages/protocols/src/esphome/native/messages.ts`**

- Import all necessary message types from `../proto/api` (ListEntities*, DeviceInfoRequest/Response, SubscribeStatesRequest, etc.)
- Implement `parseDeviceInfoResponse()` using `DeviceInfoResponse.fromBinary()`
- Implement parsing functions for ALL entity types:
- `parseLightEntity()` - ListEntitiesLightResponse.fromBinary()
- `parseSwitchEntity()` - ListEntitiesSwitchResponse.fromBinary()
- `parseSensorEntity()` - ListEntitiesSensorResponse.fromBinary()
- `parseBinarySensorEntity()` - ListEntitiesBinarySensorResponse.fromBinary()
- `parseButtonEntity()` - ListEntitiesButtonResponse.fromBinary()
- `parseNumberEntity()` - ListEntitiesNumberResponse.fromBinary()
- `parseSelectEntity()` - ListEntitiesSelectResponse.fromBinary()
- `parseClimateEntity()` - ListEntitiesClimateResponse.fromBinary()
- `parseCoverEntity()` - ListEntitiesCoverResponse.fromBinary()
- `parseFanEntity()` - ListEntitiesFanResponse.fromBinary()
- `parseTextSensorEntity()` - ListEntitiesTextSensorResponse.fromBinary()
- `parseTextEntity()` - ListEntitiesTextResponse.fromBinary()
- Add state parsing for all entity types:
- `parseLightState()` - LightStateResponse.fromBinary()
- `parseSwitchState()` - SwitchStateResponse.fromBinary()
- `parseSensorState()` - SensorStateResponse.fromBinary()
- `parseNumberState()` - NumberStateResponse.fromBinary()
- `parseClimateState()` - ClimateStateResponse.fromBinary()
- etc.

**File: `packages/protocols/src/esphome/native/protocol.ts`**

- Expand `parseMessage()` to handle ALL entity list response types (12-18, 35, 41, 43, 46, 49, 52, 55, 58, 61, 63, 97)
- Add all entity state response types (21-27, 36, 47, 50, 53, 56, 59, 64, 98)
- Reference: `.tmp/esphome-native-api/lib/utils/messages.js` lines 1-99 for complete message type mapping

### Phase 3: Implement Message Handler System

**File: `packages/protocols/src/esphome/native/client.ts`**

- Add internal `entities: Map<number, BaseEntity>` to store entity instances by key
- Add message type routing similar to reference library (connection.js:31-36)
- When receiving message type 15 (ListEntitiesLightResponse):
- Parse using `parseMessage()`
- Create `LightEntity` instance using entity factory
- Store in `entities` Map by key
- Emit 'newEntity' event
- Implement for all entity types (12-18, 35, 41, 43, 46, 49, 52, 55, 58, 61, 63, 97)
- When receiving message type 19 (ListEntitiesDoneResponse), emit 'entitiesComplete' event
- Add state message handlers (21-27, 36, 47, 50, 53, 56, 59, 64, 98):
- Parse state message
- Find entity in `entities` Map by key
- Call `entity.updateState(parsedState)`
- Emit state change event
- Update `handleMessage()` method to use `protocol.parseMessage()` and emit typed events
- Add `getEntity(key: number): BaseEntity | undefined` helper
- Reference: `.tmp/esphome-native-api/lib/client.js` lines 18-32 for entity creation pattern

**File: `packages/protocols/src/esphome/native/entities.ts`**

- This file may be refactored or removed as entity classes now handle their own structure
- Review and ensure any shared entity parsing logic is moved to entity classes

### Phase 4: Fix Hub Adapter Entity Storage

**File: `apps/hub/src/adapters/esphome.ts`**

- In `connect()` method around line 180-210, ensure connection is properly stored in `this.connections` Map BEFORE entity discovery
- Listen for client 'newEntity' events and convert ESPHome entity classes to our protocol entity structure
- Verify `connection.entities` Map is populated with entityId (string) as key, NOT ESPHome key (number)
- In entity creation around line 384, ensure `connection.entities.set(entityId, protocolEntity)` uses the full entity key like "light.apollo-air-1-12944c_rgb_light"
- Update `connection.entityKeyMap` to map ESPHome numeric key to our entityId string
- Debug log the connection Map keys and entity Map keys to verify storage
- In `sendEntityCommand()` around line 488, ensure it's searching for the correct entity ID format

### Phase 5: Fix Database Entity Lookup

**File: `apps/hub/src/daemon.ts`**

- The database query on line 634 should use `eq(entities.key, command.entityId)` NOT `eq(entities.id, command.entityId)`
- The `entities.key` field stores the entity key like "light.apollo-air-1-12944c_rgb_light"
- The `entities.id` field stores the database primary key like "entity_ir5sao0oes3nrz96dqk53u7f"
- Commands from the web-app should use the entity KEY, not the database ID

**File: `apps/web-app/src/app/(app)/app/devices/[deviceId]/_components/controls/light-control-tile.tsx`**

- Ensure `sendCommand` mutation uses the entity KEY from the entity object (e.g., `entity.key` or `entity.entityId`)
- Not the database ID (`entity.id`)

### Phase 6: Testing & Validation

- Restart hub daemon and verify entity discovery logs show parsed entities
- Test light command from hub CLI: `curl -X POST http://localhost:3100/api/command -H "Content-Type: application/json" -d '{"entityId": "light.apollo-air-1-12944c_rgb_light", "capability": "on_off", "value": true}'`
- Verify light physically changes state
- Test from web-app UI
- Test other entity types (switches, sensors, buttons)

## Key Files to Create/Modify

1. CREATE `packages/protocols/src/esphome/entities/` directory with all entity classes
2. MODIFY `packages/protocols/src/esphome/native/messages.ts` - Add all parsing functions
3. MODIFY `packages/protocols/src/esphome/native/protocol.ts` - Expand parseMessage switch
4. MODIFY `packages/protocols/src/esphome/native/client.ts` - Add message routing and entity storage
5. MODIFY `apps/hub/src/adapters/esphome.ts` - Fix entity storage with correct keys
6. MODIFY `apps/hub/src/daemon.ts` - Fix database query to use entities.key
7. MODIFY `apps/web-app/.../light-control-tile.tsx` - Use entity key not database ID

## Reference Files

- `.tmp/esphome-native-api/lib/entities/` - All entity class implementations
- `.tmp/esphome-native-api/lib/utils/messages.js` - Complete message type mapping
- `.tmp/esphome-native-api/lib/connection.js` - Message handler pattern
- `.tmp/esphome-native-api/lib/client.js` - Entity creation on message receipt
- `packages/protocols/src/esphome/proto/api.ts` - Generated protobuf types

### To-dos

- [ ] Install ts-proto and protobuf dependencies in packages/protocols
- [ ] Run protoc with ts-proto to generate TypeScript from api.proto and api_options.proto
- [ ] Refactor buildLightCommand() to use generated LightCommandRequest class
- [ ] Refactor buildSwitchCommand() to use generated SwitchCommandRequest class
- [ ] Refactor buildNumberCommand() and buildButtonCommand() with generated classes
- [ ] Update buildHello(), buildConnect(), buildPing() in messages.ts with generated classes
- [ ] Update frameMessage() and parseFrame() to use protobuf serialization/deserialization
- [ ] Update entities.ts and states.ts to use generated protobuf response types
- [ ] Remove encodeField(), encodeFloatField(), and other manual encoding functions
- [ ] Test hub daemon connects to Apollo Air 1 and discovers entities
- [ ] Test light on/off, brightness, and RGB commands from hub
- [ ] Test complete flow: web-app → tRPC → hub → ESPHome → verify light changes
- [ ] Update README with new protobuf-based architecture and build instructions
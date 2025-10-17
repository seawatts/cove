# Cove Architecture - Entity-First Design

## Overview

Cove has been redesigned with a **Home Assistant-inspired entity-first architecture** that provides better scalability, flexibility, and maintainability for smart home automation.

## Core Concepts

### 1. Entity-First Design

Instead of devices directly holding state, **entities** are the primary state holders. Each device can have multiple entities, and each entity represents a specific capability or sensor.

```
Device (ESPHome Sensor)
├── Entity: temperature_sensor (state: "23.5°C")
├── Entity: humidity_sensor (state: "65%")
└── Entity: co2_sensor (state: "450ppm")
```

### 2. Home Assistant-Inspired Schema

The database schema follows Home Assistant patterns:

- **`home`**: Top-level home configuration
- **`household`**: User groups within a home
- **`app_user`**: Individual users with roles
- **`device`**: Physical devices (bridges, hubs, etc.)
- **`entity`**: Capabilities/sensors within devices
- **`entity_state`**: Current state snapshot
- **`entity_state_history`**: Time-series data (TimescaleDB hypertable)

### 3. TimescaleDB Integration

State history is stored in TimescaleDB for efficient time-series operations:

- **Hypertables**: Automatic partitioning by time
- **Compression**: Reduces storage by 90%+
- **Retention**: Automatic data cleanup
- **Continuous Aggregates**: Pre-computed hourly/daily rollups

## Architecture Components

### Database Layer (`packages/db`)

```typescript
// Core HA-inspired tables
export const home = pgTable('home', {
  homeId: uuid('home_id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  // ...
});

export const entity = pgTable('entity', {
  entityId: text('entity_id').primaryKey(), // e.g., "sensor.kitchen_temperature"
  deviceId: uuid('device_id').references(() => device.deviceId),
  kind: text('kind').notNull(), // e.g., "sensor", "light", "switch"
  key: text('key').notNull(), // e.g., "kitchen_temperature"
  name: text('name').notNull(),
  traits: jsonb('traits'), // Capabilities and properties
  // ...
});

export const entityState = pgTable('entity_state', {
  entityId: text('entity_id').primaryKey(),
  state: text('state').notNull(), // Current state value
  attrs: jsonb('attrs'), // Additional attributes
  updatedAt: timestamp('updated_at').notNull(),
});

export const entityStateHistory = pgTable('entity_state_history', {
  id: serial('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  ts: timestamp('ts').notNull(),
  state: text('state').notNull(),
  attrs: jsonb('attrs'),
});
```

### Hub Daemon (`apps/hub`)

The hub daemon manages device discovery, entity creation, and state updates:

```typescript
// Entity-aware protocol adapters
interface EntityAwareProtocolAdapter {
  discoverEntities(deviceId: string): Promise<ProtocolEntity[]>;
  subscribeEntityState(entityId: string, callback: (state: StateUpdate) => void): void;
  sendEntityCommand(entityId: string, capability: string, value: unknown): Promise<boolean>;
}

// State management
class StateManager {
  updateState({ entityId, state, attrs }: StateUpdate): void;
  getEntityState(entityId: string): EntityState | undefined;
  // ...
}
```

### API Layer (`packages/api`)

tRPC routers provide type-safe access to entities:

```typescript
// Entity router
export const entityRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.Entity.findFirst({
        where: eq(Entity.entityId, input.entityId),
        with: { state: true }
      });
    }),

  getStateHistory: protectedProcedure
    .input(z.object({
      entityId: z.string(),
      timeRange: z.enum(['1h', '24h', '7d', '30d'])
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.EntityStateHistory.findMany({
        where: and(
          eq(EntityStateHistory.entityId, input.entityId),
          gte(EntityStateHistory.ts, getTimeRangeStart(input.timeRange))
        ),
        orderBy: [desc(EntityStateHistory.ts)]
      });
    }),
});
```

### Frontend (`apps/web-app`)

The web app displays entities instead of device state:

```typescript
// Device detail page now shows entities
async function DeviceDetails({ deviceId }: { deviceId: string }) {
  const [device, entities] = await Promise.all([
    api.device.get.fetch({ id: deviceId }),
    api.device.getEntities.fetch({ deviceId }),
  ]);

  // Group entities by type
  const entityGroups = {
    lights: entities.filter(e => e.kind === 'light'),
    sensors: entities.filter(e => e.kind === 'sensor'),
    switches: entities.filter(e => e.kind === 'switch'),
    // ...
  };

  return (
    <div>
      {/* Entity-specific controls */}
      {entityGroups.lights.map(light => (
        <LightControl key={light.entityId} entity={light} />
      ))}

      {/* Entity state history widgets */}
      {entityGroups.sensors.map(sensor => (
        <SensorWidget key={sensor.entityId} entity={sensor} />
      ))}
    </div>
  );
}
```

## Migration from Legacy Architecture

### What Changed

1. **Device State → Entity State**: Devices no longer have direct state; entities hold state
2. **State History**: Moved from `device_states` to `entity_state_history` (TimescaleDB)
3. **API Endpoints**: New entity-focused endpoints replace device state endpoints
4. **Frontend Components**: Widgets now use `entity.getStateHistory` instead of `device.getStateHistory`

### Migration Strategy

The migration maintains backward compatibility:

1. **Legacy Tables**: Old device/state tables remain for existing API routes
2. **Dual Support**: Both old and new patterns work during transition
3. **Gradual Migration**: Frontend components updated to use new entity APIs
4. **Cleanup Phase**: Legacy code removed after full migration

## Benefits

### 1. Scalability
- **TimescaleDB**: Handles millions of state changes efficiently
- **Entity Separation**: Better organization of device capabilities
- **Compression**: 90%+ storage reduction for historical data

### 2. Flexibility
- **Multiple Entities per Device**: One device can have multiple sensors/controls
- **Protocol Agnostic**: Entities work across ESPHome, Hue, Matter, etc.
- **Extensible**: Easy to add new entity types and capabilities

### 3. Performance
- **Hypertables**: Fast time-series queries
- **Continuous Aggregates**: Pre-computed rollups for dashboards
- **Efficient Indexing**: Optimized for entity-based queries

### 4. Maintainability
- **Clear Separation**: Entities, devices, and state are distinct concepts
- **Type Safety**: Full TypeScript support throughout the stack
- **Consistent Patterns**: Home Assistant-inspired design patterns

## Protocol Adapters

### ESPHome Adapter

```typescript
class ESPHomeAdapter implements EntityAwareProtocolAdapter {
  async discoverEntities(deviceId: string): Promise<ProtocolEntity[]> {
    // Connect to ESPHome device
    // List entities (sensors, lights, switches)
    // Create entity records in database
    // Return discovered entities
  }

  async sendEntityCommand(entityId: string, capability: string, value: unknown): Promise<boolean> {
    // Map capability to ESPHome command
    // Send command via Native API
    // Update entity state
  }
}
```

### Hue Adapter

```typescript
class HueAdapter implements EntityAwareProtocolAdapter {
  async discoverEntities(deviceId: string): Promise<ProtocolEntity[]> {
    // Connect to Hue bridge
    // List lights as entities
    // Create entity records for each light
    // Return discovered entities
  }

  async sendEntityCommand(entityId: string, capability: string, value: unknown): Promise<boolean> {
    // Map capability to Hue API call
    // Send command to Hue bridge
    // Update entity state
  }
}
```

## State Management Flow

1. **Device Discovery**: Hub discovers device via mDNS
2. **Entity Discovery**: Adapter discovers entities within device
3. **Entity Creation**: Entities created in database with traits
4. **State Subscription**: Adapter subscribes to entity state changes
5. **State Updates**: State changes sent to StateManager
6. **Persistence**: State saved to entity_state and entity_state_history
7. **Frontend Updates**: Real-time updates via WebSocket/tRPC

## Future Enhancements

### Phase 1: Core Entity System ✅
- [x] Entity-first database schema
- [x] TimescaleDB integration
- [x] Entity-aware protocol adapters
- [x] Frontend entity display

### Phase 2: Advanced Features
- [ ] Entity relationships (via_device_id)
- [ ] Entity groups and areas
- [ ] Entity templates and blueprints
- [ ] Advanced automation triggers

### Phase 3: Protocol Expansion
- [ ] Matter protocol support
- [ ] Zigbee integration
- [ ] Z-Wave support
- [ ] Custom protocol framework

## Conclusion

The entity-first architecture provides a solid foundation for scalable home automation. By separating devices from their capabilities (entities) and leveraging TimescaleDB for efficient time-series storage, Cove can handle complex smart home setups while maintaining excellent performance and user experience.

The migration maintains backward compatibility while providing a clear path forward for advanced features and protocol support.

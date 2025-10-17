# Schema TODO - Missing Elements for Hub Daemon

This document tracks schema elements that are referenced in the hub daemon but not yet defined in `packages/db/src/schema.ts`. These need to be added to complete the Home Assistant++ architecture.

## Required Tables

### 1. Commands Table
**Purpose**: Queue entity commands for processing by protocol adapters

```typescript
export const commands = pgTable('commands', {
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'cmd' }))
    .notNull()
    .primaryKey(),
  entityId: text('entityId')
    .notNull()
    .references(() => entity.id, { onDelete: 'cascade' }),
  capability: text('capability').notNull(), // e.g., 'on_off', 'brightness', 'color_temp'
  value: jsonb('value').notNull(), // Command value (boolean, number, object)
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  error: text('error'), // Error message if status is 'failed'
}, (t) => [
  index('commands_entityId_idx').on(t.entityId),
  index('commands_status_idx').on(t.status),
  index('commands_createdAt_idx').on(t.createdAt),
]);
```

**Relations**:
```typescript
export const commandsRelations = relations(commands, ({ one }) => ({
  entity: one(entity, {
    fields: [commands.entityId],
    references: [entity.id],
  }),
}));
```

## Required Device Table Fields

### 2. Protocol Field
**Purpose**: Track which protocol adapter handles this device

```typescript
// Add to existing device table
protocol: text('protocol'), // 'esphome', 'hue', 'matter', etc.
```

### 3. Device State Fields
**Purpose**: Track device online status and capabilities

```typescript
// Add to existing device table
online: boolean('online').notNull().default(true),
available: boolean('available').notNull().default(true),
lastSeen: timestamp('lastSeen', { withTimezone: true }),
capabilities: jsonb('capabilities'), // Array of supported capabilities
```

### 4. External ID Field
**Purpose**: Deduplicate devices across hub restarts

```typescript
// Add to existing device table
externalId: text('externalId').unique(), // For deduplication
```

## Required Entity Table Fields

### 5. Entity Name Field
**Purpose**: Human-readable name for entities

```typescript
// Add to existing entity table
name: text('name').notNull(), // Human-readable name
```

## Future Enhancements

### 6. Protocol Configuration Table
**Purpose**: Store protocol-specific configuration per device

```typescript
export const protocolConfig = pgTable('protocolConfig', {
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'protocol' }))
    .notNull()
    .primaryKey(),
  deviceId: text('deviceId')
    .notNull()
    .references(() => device.id, { onDelete: 'cascade' }),
  protocol: text('protocol').notNull(),
  config: jsonb('config').notNull(), // Protocol-specific configuration
  credentials: jsonb('credentials'), // Encrypted credentials
}, (t) => [
  unique('protocolConfig_deviceId_protocol').on(t.deviceId, t.protocol),
]);
```

### 7. Device Groups Table
**Purpose**: Group related devices (e.g., Hue bridge + lights)

```typescript
export const deviceGroup = pgTable('deviceGroup', {
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'group' }))
    .notNull()
    .primaryKey(),
  homeId: text('homeId')
    .notNull()
    .references(() => home.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  deviceIds: jsonb('deviceIds').notNull(), // Array of device IDs
}, (t) => [
  index('deviceGroup_homeId_idx').on(t.homeId),
]);
```

### 8. Entity Groups Table
**Purpose**: Group related entities (e.g., all lights in a room)

```typescript
export const entityGroup = pgTable('entityGroup', {
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'egroup' }))
    .notNull()
    .primaryKey(),
  homeId: text('homeId')
    .notNull()
    .references(() => home.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  entityIds: jsonb('entityIds').notNull(), // Array of entity IDs
}, (t) => [
  index('entityGroup_homeId_idx').on(t.homeId),
]);
```

## Implementation Priority

### Phase 1 (Required for Hub Functionality)
1. **Commands table** - Essential for entity command processing
2. **Protocol field on device** - Required for adapter routing
3. **Device state fields** - Online/available status tracking
4. **External ID field** - Device deduplication
5. **Entity name field** - Human-readable entity names

### Phase 2 (Enhanced Functionality)
6. **Protocol configuration table** - Advanced protocol management
7. **Device groups table** - Device organization
8. **Entity groups table** - Entity organization

## Migration Notes

- All new fields should be nullable initially to avoid breaking existing data
- Use `$defaultFn(() => createId({ prefix: '...' }))` for ID fields
- Add proper indexes for performance
- Include foreign key constraints with cascade deletes
- Use JSONB for flexible configuration storage

## Related Files

- `packages/db/src/schema.ts` - Main schema definition
- `apps/hub/src/db.ts` - Database operations using these tables
- `apps/hub/src/command-processor.ts` - Uses commands table
- `apps/hub/src/adapters/` - Uses protocol field and config

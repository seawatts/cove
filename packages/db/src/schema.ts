import { createId } from '@cove/id';
import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

// Helper function to get user ID from Clerk JWT
const requestingUserId = () => sql`requesting_user_id()`;

// Helper function to get org ID from Clerk JWT
const requestingOrgId = () => sql`requesting_org_id()`;

export const userRoleEnum = pgEnum('userRole', ['admin', 'superAdmin', 'user']);
export const localConnectionStatusEnum = pgEnum('localConnectionStatus', [
  'connected',
  'disconnected',
]);
export const stripeSubscriptionStatusEnum = pgEnum('stripeSubscriptionStatus', [
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'paused',
  'trialing',
  'unpaid',
]);

export const apiKeyUsageTypeEnum = pgEnum('apiKeyUsageType', ['mcp-server']);

export const UserRoleType = z.enum(userRoleEnum.enumValues).enum;
export const LocalConnectionStatusType = z.enum(
  localConnectionStatusEnum.enumValues,
).enum;
export const StripeSubscriptionStatusType = z.enum(
  stripeSubscriptionStatusEnum.enumValues,
).enum;
export const ApiKeyUsageTypeType = z.enum(apiKeyUsageTypeEnum.enumValues).enum;

export const Users = pgTable('user', {
  avatarUrl: text('avatarUrl'),
  clerkId: text('clerkId').unique().notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  email: text('email').notNull(),
  firstName: text('firstName'),
  id: varchar('id', { length: 128 }).notNull().primaryKey(),
  lastLoggedInAt: timestamp('lastLoggedInAt', {
    mode: 'date',
    withTimezone: true,
  }),
  lastName: text('lastName'),
  online: boolean('online').default(false).notNull(),
  updatedAt: timestamp('updatedAt', {
    mode: 'date',
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),
});

export const UsersRelations = relations(Users, ({ many }) => ({
  apiKeys: many(ApiKeys),
  apiKeyUsage: many(ApiKeyUsage),
  authCodes: many(AuthCodes),
  orgMembers: many(OrgMembers),
}));

export type UserType = typeof Users.$inferSelect;

export const CreateUserSchema = createInsertSchema(Users).omit({
  createdAt: true,
  id: true,
  updatedAt: true,
});

export const Orgs = pgTable('orgs', {
  clerkOrgId: text('clerkOrgId').unique().notNull(),
  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  }).defaultNow(),
  createdByUserId: varchar('createdByUserId')
    .references(() => Users.id, {
      onDelete: 'cascade',
    })
    .notNull(),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'org' }))
    .notNull()
    .primaryKey(),
  name: text('name').notNull().unique(),
  // Stripe fields
  stripeCustomerId: text('stripeCustomerId'),
  stripeSubscriptionId: text('stripeSubscriptionId'),
  stripeSubscriptionStatus: stripeSubscriptionStatusEnum(
    'stripeSubscriptionStatus',
  ),
  updatedAt: timestamp('updatedAt', {
    mode: 'date',
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),
});

export type OrgType = typeof Orgs.$inferSelect;

export const updateOrgSchema = createInsertSchema(Orgs).omit({
  createdAt: true,
  createdByUserId: true,
  id: true,
  updatedAt: true,
});

export const OrgsRelations = relations(Orgs, ({ one, many }) => ({
  apiKeys: many(ApiKeys),
  apiKeyUsage: many(ApiKeyUsage),
  authCodes: many(AuthCodes),
  createdByUser: one(Users, {
    fields: [Orgs.createdByUserId],
    references: [Users.id],
  }),
  orgMembers: many(OrgMembers),
}));

// Company Members Table
export const OrgMembers = pgTable(
  'orgMembers',
  {
    createdAt: timestamp('createdAt', {
      mode: 'date',
      withTimezone: true,
    }).defaultNow(),
    id: varchar('id', { length: 128 })
      .$defaultFn(() => createId({ prefix: 'member' }))
      .notNull()
      .primaryKey(),
    orgId: varchar('orgId')
      .references(() => Orgs.id, {
        onDelete: 'cascade',
      })
      .notNull()
      .default(requestingOrgId()),
    role: userRoleEnum('role').default('user').notNull(),
    updatedAt: timestamp('updatedAt', {
      mode: 'date',
      withTimezone: true,
    }).$onUpdateFn(() => new Date()),
    userId: varchar('userId')
      .references(() => Users.id, {
        onDelete: 'cascade',
      })
      .notNull()
      .default(requestingUserId()),
  },
  (table) => [
    // Unique constraint for userId and orgId combination
    unique('orgMembers_userId_orgId_unique').on(table.userId, table.orgId),
  ],
);

export type OrgMembersType = typeof OrgMembers.$inferSelect & {
  user?: UserType;
  org?: OrgType;
};

export const OrgMembersRelations = relations(OrgMembers, ({ one }) => ({
  org: one(Orgs, {
    fields: [OrgMembers.orgId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [OrgMembers.userId],
    references: [Users.id],
  }),
}));

export const AuthCodes = pgTable('authCodes', {
  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expiresAt', {
    mode: 'date',
    withTimezone: true,
  })
    .$defaultFn(() => new Date(Date.now() + 1000 * 60 * 30)) // 30 minutes
    .notNull(),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'ac' }))
    .notNull()
    .primaryKey(),
  orgId: varchar('orgId')
    .references(() => Orgs.id, {
      onDelete: 'cascade',
    })
    .notNull()
    .default(requestingOrgId()),
  sessionId: text('sessionId').notNull(),
  updatedAt: timestamp('updatedAt', {
    mode: 'date',
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),
  usedAt: timestamp('usedAt', {
    mode: 'date',
    withTimezone: true,
  }),
  userId: varchar('userId')
    .references(() => Users.id, {
      onDelete: 'cascade',
    })
    .notNull()
    .default(requestingUserId()),
});

export type AuthCodeType = typeof AuthCodes.$inferSelect;

export const AuthCodesRelations = relations(AuthCodes, ({ one }) => ({
  org: one(Orgs, {
    fields: [AuthCodes.orgId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [AuthCodes.userId],
    references: [Users.id],
  }),
}));

// API Keys Table
export const ApiKeys = pgTable('apiKeys', {
  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expiresAt', {
    mode: 'date',
    withTimezone: true,
  }),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'ak' }))
    .notNull()
    .primaryKey(),
  isActive: boolean('isActive').notNull().default(true),
  key: text('key')
    .notNull()
    .unique()
    .$defaultFn(() => createId({ prefix: 'usk', prefixSeparator: '-live-' })),
  lastUsedAt: timestamp('lastUsedAt', {
    mode: 'date',
    withTimezone: true,
  }),
  name: text('name').notNull(),
  orgId: varchar('orgId')
    .references(() => Orgs.id, {
      onDelete: 'cascade',
    })
    .notNull()
    .default(requestingOrgId()),
  updatedAt: timestamp('updatedAt', {
    mode: 'date',
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),
  userId: varchar('userId')
    .references(() => Users.id, {
      onDelete: 'cascade',
    })
    .notNull()
    .default(requestingUserId()),
});

export type ApiKeyType = typeof ApiKeys.$inferSelect;

export const CreateApiKeySchema = createInsertSchema(ApiKeys).omit({
  createdAt: true,
  id: true,
  lastUsedAt: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const UpdateApiKeySchema = createUpdateSchema(ApiKeys).omit({
  createdAt: true,
  id: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const ApiKeysRelations = relations(ApiKeys, ({ one, many }) => ({
  org: one(Orgs, {
    fields: [ApiKeys.orgId],
    references: [Orgs.id],
  }),
  usage: many(ApiKeyUsage),
  user: one(Users, {
    fields: [ApiKeys.userId],
    references: [Users.id],
  }),
}));

// API Key Usage Table
export const ApiKeyUsage = pgTable('apiKeyUsage', {
  apiKeyId: varchar('apiKeyId', { length: 128 })
    .references(() => ApiKeys.id, {
      onDelete: 'cascade',
    })
    .notNull(),
  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'aku' }))
    .notNull()
    .primaryKey(),
  // Generic metadata for different usage types
  metadata: json('metadata').$type<Record<string, unknown>>(),
  orgId: varchar('orgId')
    .references(() => Orgs.id, {
      onDelete: 'cascade',
    })
    .notNull()
    .default(requestingOrgId()),
  type: apiKeyUsageTypeEnum('type').notNull(),
  updatedAt: timestamp('updatedAt', {
    mode: 'date',
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),
  userId: varchar('userId')
    .references(() => Users.id, {
      onDelete: 'cascade',
    })
    .notNull()
    .default(requestingUserId()),
});

export type ApiKeyUsageType = typeof ApiKeyUsage.$inferSelect;

export const CreateApiKeyUsageSchema = createInsertSchema(ApiKeyUsage).omit({
  createdAt: true,
  id: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const ApiKeyUsageRelations = relations(ApiKeyUsage, ({ one }) => ({
  apiKey: one(ApiKeys, {
    fields: [ApiKeyUsage.apiKeyId],
    references: [ApiKeys.id],
  }),
  org: one(Orgs, {
    fields: [ApiKeyUsage.orgId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [ApiKeyUsage.userId],
    references: [Users.id],
  }),
}));

// ShortUrls table removed - not needed for home automation

// ===================================
// Home Automation Tables
// ===================================

// Enums for home automation
export const deviceTypeEnum = pgEnum('deviceType', [
  'light',
  'switch',
  'sensor',
  'thermostat',
  'lock',
  'camera',
  'speaker',
  'fan',
  'outlet',
  'cove_hub', // Our Cove Hub device (the thing running this daemon)
  'hub', // Other hub devices (Hue Bridge, SmartThings, etc.)
  'other',
]);

export const deviceCapabilityEnum = pgEnum('deviceCapability', [
  'on_off',
  'brightness',
  'color_temperature',
  'color_rgb',
  'temperature',
  'humidity',
  'air_quality',
  'co2',
  'pressure',
  'motion',
  'occupancy',
  'contact_sensor',
  'battery',
  'power_consumption',
  'voltage',
  'lock',
  'unlock',
  'audio_volume',
  'audio_playback',
  'video_stream',
  'fan_speed',
  'heating',
  'cooling',
  'target_temperature',
  'custom',
]);

export const protocolTypeEnum = pgEnum('protocolType', [
  'esphome',
  'hue',
  'matter',
  'sonos',
  'zigbee',
  'zwave',
  'wifi',
  'bluetooth',
  'mqtt',
  'http',
]);

export const eventSeverityEnum = pgEnum('eventSeverity', [
  'info',
  'warning',
  'error',
  'critical',
]);

export const eventTypeEnum = pgEnum('eventType', [
  'hub_started',
  'hub_stopped',
  'device_discovered',
  'device_lost',
  'device_connected',
  'device_disconnected',
  'adapter_initialized',
  'adapter_error',
  'adapter_shutdown',
  'command_processed',
  'command_failed',
  'sync_success',
  'sync_error',
  'system_error',
  'config_updated',
  // Device activity events (user-facing)
  'state_changed',
  'lock_accessed',
  'lock_unlocked',
  'lock_locked',
  'motion_detected',
  'motion_cleared',
  'camera_stream_started',
  'camera_stream_stopped',
  'camera_motion_detected',
  'sensor_threshold_exceeded',
  'sensor_threshold_normal',
  'device_tampered',
  'battery_low',
  'battery_critical',
]);

// Export Zod enums for validation
export const DeviceTypeEnum = z.enum(deviceTypeEnum.enumValues).enum;
export const DeviceCapabilityEnum = z.enum(
  deviceCapabilityEnum.enumValues,
).enum;
export const ProtocolTypeEnum = z.enum(protocolTypeEnum.enumValues).enum;
export const EventSeverityEnum = z.enum(eventSeverityEnum.enumValues).enum;
export const EventTypeEnum = z.enum(eventTypeEnum.enumValues).enum;

// Export TypeScript types for enum values (single source of truth)
// Note: DeviceType (table row) is exported below, so we use DeviceTypeValue for the enum
export type DeviceTypeValue = (typeof deviceTypeEnum.enumValues)[number];
export type DeviceCapabilityValue =
  (typeof deviceCapabilityEnum.enumValues)[number];
export type ProtocolTypeValue = (typeof protocolTypeEnum.enumValues)[number];
export type EventSeverityValue = (typeof eventSeverityEnum.enumValues)[number];
export type EventTypeValue = (typeof eventTypeEnum.enumValues)[number];

// Hubs table removed - hubs are now stored in Devices table with deviceType='hub'
// Hub-specific configuration stored in device config field
// Other devices reference their managing hub via hubId field (points to hub device ID)

// Rooms Table
export const Rooms = pgTable('rooms', {
  automationsEnabled: boolean('automationsEnabled').default(true).notNull(),
  color: text('color'),

  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  description: text('description'),

  floor: json('floor').$type<number>(),
  icon: text('icon'),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'room' }))
    .notNull()
    .primaryKey(),
  name: text('name').notNull(),
  orgId: varchar('orgId')
    .references(() => Orgs.id, { onDelete: 'cascade' })
    .default(requestingOrgId()),
  updatedAt: timestamp('updatedAt', {
    mode: 'date',
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),

  userId: varchar('userId')
    .references(() => Users.id, { onDelete: 'cascade' })
    .notNull()
    .default(requestingUserId()),
});

export type RoomType = typeof Rooms.$inferSelect;
export const CreateRoomSchema = createInsertSchema(Rooms).omit({
  createdAt: true,
  id: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const RoomsRelations = relations(Rooms, ({ one, many }) => ({
  devices: many(Devices),
  org: one(Orgs, {
    fields: [Rooms.orgId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [Rooms.userId],
    references: [Users.id],
  }),
}));

// Devices Table
export const Devices = pgTable(
  'devices',
  {
    available: boolean('available').default(true).notNull(),

    capabilities: json('capabilities').$type<string[]>().notNull().default([]),
    config: json('config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    createdAt: timestamp('createdAt', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    deviceType: deviceTypeEnum('deviceType').notNull(),

    // External unique identifier for deduplication (protocol-specific)
    // Examples: "hue_bridge123_light_4", "esphome_livingroom_temp", "matter_abc123"
    // This is what we use to prevent duplicates, not the database ID
    externalId: text('externalId').unique().notNull(),

    // Local hostname (e.g., "Sonos-7828CA22AF1C.local", "apollo-air-1.local")
    host: text('host'),

    // hubId now references another device with deviceType='hub' (self-referential FK)
    hubId: varchar('hubId', { length: 128 }).references(
      (): AnyPgColumn => Devices.id,
      {
        onDelete: 'cascade',
      },
    ),
    id: varchar('id', { length: 128 })
      .$defaultFn(() => createId({ prefix: 'device' }))
      .notNull()
      .primaryKey(),

    ipAddress: text('ipAddress'),

    lastSeen: timestamp('lastSeen', {
      mode: 'date',
      withTimezone: true,
    }),
    macAddress: text('macAddress'),

    // Device identification (common across all protocols)
    manufacturer: text('manufacturer'), // e.g., "Philips", "Sonos", "Espressif"
    model: text('model'), // e.g., "Hue White A19", "One SL", "ESP32"

    name: text('name').notNull(),

    online: boolean('online').default(false).notNull(),
    orgId: varchar('orgId')
      .references(() => Orgs.id, { onDelete: 'cascade' })
      .default(requestingOrgId()),
    protocol: protocolTypeEnum('protocol'),

    roomId: varchar('roomId', { length: 128 }).references(() => Rooms.id, {
      onDelete: 'set null',
    }),

    state: json('state').$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp('updatedAt', {
      mode: 'date',
      withTimezone: true,
    }).$onUpdateFn(() => new Date()),

    userId: varchar('userId')
      .references(() => Users.id, { onDelete: 'cascade' })
      .default(requestingUserId()),

    // Hub-specific field (only used when deviceType='hub')
    version: text('version'),
  },
  (table) => [
    // Index for faster lookups by IP and MAC
    index('devices_ipAddress_idx').on(table.ipAddress),
    index('devices_macAddress_idx').on(table.macAddress),
  ],
);

export type DeviceType = typeof Devices.$inferSelect;
export const CreateDeviceSchema = createInsertSchema(Devices).omit({
  createdAt: true,
  id: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const DevicesRelations = relations(Devices, ({ one, many }) => ({
  commands: many(Commands),
  entities: many(Entities),
  events: many(Events),
  // Self-referential: devices managed by this hub (only if this device is a hub)
  managedDevices: many(Devices, {
    relationName: 'hubDevices',
  }),
  org: one(Orgs, {
    fields: [Devices.orgId],
    references: [Orgs.id],
  }),
  // Self-referential: the hub device that manages this device
  parentHub: one(Devices, {
    fields: [Devices.hubId],
    references: [Devices.id],
    relationName: 'hubDevices',
  }),
  room: one(Rooms, {
    fields: [Devices.roomId],
    references: [Rooms.id],
  }),
  stateHistory: many(States),
  user: one(Users, {
    fields: [Devices.userId],
    references: [Users.id],
  }),
}));

// States Table (time-series state changes)
// Replaces DeviceMetrics - follows Home Assistant pattern where all state changes are history
// Note: For TimescaleDB hypertables, primary key must include partitioning column (lastChanged)
export const States = pgTable(
  'states',
  {
    attributes: json('attributes').$type<Record<string, unknown>>().default({}),
    deviceId: varchar('deviceId', { length: 128 })
      .references(() => Devices.id, { onDelete: 'cascade' })
      .notNull(),
    id: varchar('id', { length: 128 })
      .$defaultFn(() => createId({ prefix: 'state' }))
      .notNull(),

    // When the state actually changed (different from lastUpdated)
    // This is the partitioning column for TimescaleDB hypertable
    lastChanged: timestamp('lastChanged', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    // When this record was written/updated
    lastUpdated: timestamp('lastUpdated', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    // State value - can be primitive (delta storage) or object (full state)
    // Delta storage: { state: 280, attributes: { entityName: "CO2", stateKey: "co2" } }
    // Full state: { state: { co2: 280, temp: 22, ... }, attributes: { ... } }
    state: json('state').notNull(),
  },
  (table) => [
    // Index for time-range queries (most common query pattern)
    index('states_deviceId_lastChanged_idx').on(
      table.deviceId,
      table.lastChanged,
    ),
    // Composite primary key (required for TimescaleDB hypertable)
    // Must include partitioning column (lastChanged)
    primaryKey({ columns: [table.id, table.lastChanged] }),
  ],
);

export type StateType = typeof States.$inferSelect;
export const CreateStateSchema = createInsertSchema(States).omit({
  id: true,
});

export const StatesRelations = relations(States, ({ one }) => ({
  device: one(Devices, {
    fields: [States.deviceId],
    references: [Devices.id],
  }),
  // Note: events relation removed because TimescaleDB hypertables don't support FK constraints
  // Events can reference states via stateId, but no automatic relation
}));

// Legacy export for backwards compatibility
export const DeviceStateHistory = States;
export type DeviceStateHistoryType = StateType;
export const CreateDeviceStateHistorySchema = CreateStateSchema;
export const DeviceStateHistoryRelations = StatesRelations;

// DeviceMetrics table removed - replaced by DeviceStateHistory

// Entities Table (for ESPHome entity metadata)
export const Entities = pgTable('entities', {
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  currentValue: json('currentValue'), // Current state value
  deviceClass: text('deviceClass'),
  deviceId: varchar('deviceId', { length: 128 })
    .references(() => Devices.id, { onDelete: 'cascade' })
    .notNull(),

  // State
  disabled: boolean('disabled').default(false),
  effects: json('effects').$type<string[]>(),

  // Entity type and capabilities
  entityType: text('entityType').notNull(), // 'sensor', 'button', 'number', 'light', 'switch'
  icon: text('icon'),
  id: varchar('id', { length: 128 }).primaryKey(),

  // ESPHome entity info
  key: integer('key').notNull(), // ESPHome entity key
  maxValue: real('maxValue'),

  // Number-specific
  minValue: real('minValue'),
  name: text('name').notNull(), // Display name
  objectId: text('objectId'), // e.g., "co2", "temperature_offset"
  step: real('step'),

  // Light-specific
  supportsBrightness: boolean('supportsBrightness'),
  supportsColorTemp: boolean('supportsColorTemp'),
  supportsRgb: boolean('supportsRgb'),
  uniqueId: text('uniqueId'),
  unitOfMeasurement: text('unitOfMeasurement'),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export type EntityType = typeof Entities.$inferSelect;
export const CreateEntitySchema = createInsertSchema(Entities).omit({
  createdAt: true,
  id: true,
  updatedAt: true,
});

export const EntitiesRelations = relations(Entities, ({ one }) => ({
  device: one(Devices, {
    fields: [Entities.deviceId],
    references: [Devices.id],
  }),
}));

// Commands Table (for hub daemon command queue)
export const commandStatusEnum = pgEnum('commandStatus', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const CommandStatusType = z.enum(commandStatusEnum.enumValues).enum;

export const Commands = pgTable('commands', {
  capability: text('capability').notNull(),

  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  deviceId: varchar('deviceId', { length: 128 })
    .references(() => Devices.id, { onDelete: 'cascade' })
    .notNull(),
  error: text('error'),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'cmd' }))
    .notNull()
    .primaryKey(),

  processedAt: timestamp('processedAt', {
    mode: 'date',
    withTimezone: true,
  }),

  status: commandStatusEnum('status').default('pending').notNull(),

  userId: varchar('userId')
    .references(() => Users.id, { onDelete: 'cascade' })
    .notNull()
    .default(requestingUserId()),
  value: json('value').notNull(),
});

export type CommandType = typeof Commands.$inferSelect;
export const CreateCommandSchema = createInsertSchema(Commands).omit({
  createdAt: true,
  id: true,
  userId: true,
});

export const CommandsRelations = relations(Commands, ({ one }) => ({
  device: one(Devices, {
    fields: [Commands.deviceId],
    references: [Devices.id],
  }),
  user: one(Users, {
    fields: [Commands.userId],
    references: [Users.id],
  }),
}));

// Legacy exports for backwards compatibility
export const DeviceCommands = Commands;
export type DeviceCommandType = CommandType;
export const CreateDeviceCommandSchema = CreateCommandSchema;
export const DeviceCommandsRelations = CommandsRelations;

// Automations Table
export const Automations = pgTable('automations', {
  actions: json('actions').$type<Array<Record<string, unknown>>>().notNull(),
  conditions: json('conditions')
    .$type<Array<Record<string, unknown>>>()
    .notNull()
    .default([]),

  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(true).notNull(),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'auto' }))
    .notNull()
    .primaryKey(),

  lastTriggered: timestamp('lastTriggered', {
    mode: 'date',
    withTimezone: true,
  }),
  name: text('name').notNull(),
  orgId: varchar('orgId')
    .references(() => Orgs.id, { onDelete: 'cascade' })
    .default(requestingOrgId()),

  trigger: json('trigger').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updatedAt', {
    mode: 'date',
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),

  userId: varchar('userId')
    .references(() => Users.id, { onDelete: 'cascade' })
    .notNull()
    .default(requestingUserId()),
});

export type AutomationType = typeof Automations.$inferSelect;
export const CreateAutomationSchema = createInsertSchema(Automations).omit({
  createdAt: true,
  id: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const AutomationsRelations = relations(Automations, ({ one }) => ({
  org: one(Orgs, {
    fields: [Automations.orgId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [Automations.userId],
    references: [Users.id],
  }),
}));

// Scenes Table
export const Scenes = pgTable('scenes', {
  actions: json('actions').$type<Array<Record<string, unknown>>>().notNull(),

  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  description: text('description'),
  icon: text('icon'),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'scene' }))
    .notNull()
    .primaryKey(),

  lastActivated: timestamp('lastActivated', {
    mode: 'date',
    withTimezone: true,
  }),
  name: text('name').notNull(),
  orgId: varchar('orgId')
    .references(() => Orgs.id, { onDelete: 'cascade' })
    .default(requestingOrgId()),
  updatedAt: timestamp('updatedAt', {
    mode: 'date',
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),

  userId: varchar('userId')
    .references(() => Users.id, { onDelete: 'cascade' })
    .notNull()
    .default(requestingUserId()),
});

export type SceneType = typeof Scenes.$inferSelect;
export const CreateSceneSchema = createInsertSchema(Scenes).omit({
  createdAt: true,
  id: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const ScenesRelations = relations(Scenes, ({ one }) => ({
  org: one(Orgs, {
    fields: [Scenes.orgId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [Scenes.userId],
    references: [Users.id],
  }),
}));

// Events Table (Activity Feed for ALL devices including hubs)
// Captures both system diagnostics AND user-facing device activity
export const Events = pgTable('events', {
  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  deviceId: varchar('deviceId', { length: 128 })
    .references(() => Devices.id, { onDelete: 'cascade' })
    .notNull(),

  eventType: eventTypeEnum('eventType').notNull(),

  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'event' }))
    .notNull()
    .primaryKey(),

  message: text('message').notNull(),

  metadata: json('metadata').$type<Record<string, unknown>>(),

  severity: eventSeverityEnum('severity').notNull().default('info'),

  // Optional link to state history entry (for state_changed events)
  // Note: No FK constraint because TimescaleDB hypertables don't support FK constraints pointing to them
  stateId: varchar('stateId', { length: 128 }),

  timestamp: timestamp('timestamp', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export type EventType = typeof Events.$inferSelect;
export const CreateEventSchema = createInsertSchema(Events).omit({
  createdAt: true,
  id: true,
});

export const EventsRelations = relations(Events, ({ one }) => ({
  device: one(Devices, {
    fields: [Events.deviceId],
    references: [Devices.id],
  }),
  // Note: stateHistory relation removed because TimescaleDB hypertables don't support FK constraints
  // You can still join manually using stateId, but no automatic relation
}));

// Widget Preferences Table
export const WidgetPreferences = pgTable(
  'widgetPreferences',
  {
    createdAt: timestamp('createdAt', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    deviceId: varchar('deviceId', { length: 128 })
      .references(() => Devices.id, { onDelete: 'cascade' })
      .notNull(),
    id: varchar('id', { length: 128 })
      .$defaultFn(() => createId({ prefix: 'widget_pref' }))
      .primaryKey(),

    sensorKey: varchar('sensorKey', { length: 128 }).notNull(),

    updatedAt: timestamp('updatedAt', {
      mode: 'date',
      withTimezone: true,
    }).$onUpdateFn(() => new Date()),

    userId: varchar('userId', { length: 128 }).notNull(),

    widgetConfig: json('widgetConfig')
      .$type<Record<string, unknown>>()
      .default({}),

    widgetType: varchar('widgetType', { length: 50 }).notNull(), // 'chart', 'value_card', 'gauge', 'table', 'radial'
  },
  (table) => [
    // Unique constraint: one preference per user/device/sensor combination
    unique('user_device_sensor_unique').on(
      table.userId,
      table.deviceId,
      table.sensorKey,
    ),
  ],
);

export type WidgetPreferenceType = typeof WidgetPreferences.$inferSelect;
export const CreateWidgetPreferenceSchema = createInsertSchema(
  WidgetPreferences,
).omit({
  createdAt: true,
  id: true,
  updatedAt: true,
});

export const WidgetPreferencesRelations = relations(
  WidgetPreferences,
  ({ one }) => ({
    device: one(Devices, {
      fields: [WidgetPreferences.deviceId],
      references: [Devices.id],
    }),
  }),
);

// Legacy exports for backwards compatibility
export const DeviceEvents = Events;
export type DeviceEventType = EventType;
export const CreateDeviceEventSchema = CreateEventSchema;
export const DeviceEventsRelations = EventsRelations;

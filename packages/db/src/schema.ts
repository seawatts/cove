import { createId } from '@cove/id';
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  json,
  pgEnum,
  pgTable,
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
    // Add unique constraint for userId and orgId combination using the simpler syntax
    unique().on(table.userId, table.orgId),
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

export const ShortUrls = pgTable('shortUrls', {
  code: varchar('code', { length: 128 }).notNull(),
  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  }).defaultNow(),
  expiresAt: timestamp('expiresAt', {
    mode: 'date',
    withTimezone: true,
  }),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'shortUrl' }))
    .notNull()
    .primaryKey(),
  isActive: boolean('isActive').notNull().default(true),
  orgId: varchar('orgId')
    .references(() => Orgs.id, {
      onDelete: 'cascade',
    })
    .notNull()
    .default(requestingOrgId()),
  redirectUrl: text('redirectUrl').notNull(),
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

export type ShortUrlType = typeof ShortUrls.$inferSelect;

export const CreateShortUrlSchema = createInsertSchema(ShortUrls).omit({
  createdAt: true,
  id: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const UpdateShortUrlSchema = createUpdateSchema(ShortUrls).omit({
  createdAt: true,
  id: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const ShortUrlsRelations = relations(ShortUrls, ({ one }) => ({
  org: one(Orgs, {
    fields: [ShortUrls.orgId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [ShortUrls.userId],
    references: [Users.id],
  }),
}));

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
  'zigbee',
  'zwave',
  'wifi',
  'bluetooth',
  'mqtt',
  'http',
]);

export const DeviceTypeEnum = z.enum(deviceTypeEnum.enumValues).enum;
export const DeviceCapabilityEnum = z.enum(
  deviceCapabilityEnum.enumValues,
).enum;
export const ProtocolTypeEnum = z.enum(protocolTypeEnum.enumValues).enum;

// Hubs Table
export const Hubs = pgTable('hubs', {
  config: json('config').$type<{
    discoveryEnabled: boolean;
    discoveryInterval: number;
    enabledProtocols: string[];
    telemetryInterval: number;
    autoUpdate: boolean;
    updateChannel: 'stable' | 'beta' | 'dev';
    apiPort: number;
    wsPort?: number;
  }>(),

  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'hub' }))
    .notNull()
    .primaryKey(),

  ipAddress: text('ipAddress'),
  lastSeen: timestamp('lastSeen', {
    mode: 'date',
    withTimezone: true,
  }),
  macAddress: text('macAddress'),
  name: text('name').notNull(),

  online: boolean('online').default(false).notNull(),
  orgId: varchar('orgId')
    .references(() => Orgs.id, { onDelete: 'cascade' })
    .default(requestingOrgId()),

  systemInfo: json('systemInfo').$type<{
    platform?: string;
    arch?: string;
    hostname?: string;
    uptime?: number;
    memory?: { total: number; free: number; used: number };
    cpu?: { count: number; model?: string; usage?: number };
  }>(),
  updatedAt: timestamp('updatedAt', {
    mode: 'date',
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),

  userId: varchar('userId')
    .references(() => Users.id, { onDelete: 'cascade' })
    .notNull()
    .default(requestingUserId()),
  version: text('version').notNull(),
});

export type HubType = typeof Hubs.$inferSelect;
export const CreateHubSchema = createInsertSchema(Hubs).omit({
  createdAt: true,
  id: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const HubsRelations = relations(Hubs, ({ one, many }) => ({
  devices: many(Devices),
  org: one(Orgs, {
    fields: [Hubs.orgId],
    references: [Orgs.id],
  }),
  user: one(Users, {
    fields: [Hubs.userId],
    references: [Users.id],
  }),
}));

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
export const Devices = pgTable('devices', {
  available: boolean('available').default(true).notNull(),

  capabilities: json('capabilities').$type<string[]>().notNull().default([]),
  config: json('config').$type<Record<string, unknown>>().notNull().default({}),

  createdAt: timestamp('createdAt', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  deviceType: deviceTypeEnum('deviceType').notNull(),
  hubId: varchar('hubId', { length: 128 }).references(() => Hubs.id, {
    onDelete: 'cascade',
  }),
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
    .notNull()
    .default(requestingUserId()),
});

export type DeviceType = typeof Devices.$inferSelect;
export const CreateDeviceSchema = createInsertSchema(Devices).omit({
  createdAt: true,
  id: true,
  orgId: true,
  updatedAt: true,
  userId: true,
});

export const DevicesRelations = relations(Devices, ({ one, many }) => ({
  hub: one(Hubs, {
    fields: [Devices.hubId],
    references: [Hubs.id],
  }),
  metrics: many(DeviceMetrics),
  org: one(Orgs, {
    fields: [Devices.orgId],
    references: [Orgs.id],
  }),
  room: one(Rooms, {
    fields: [Devices.roomId],
    references: [Rooms.id],
  }),
  user: one(Users, {
    fields: [Devices.userId],
    references: [Users.id],
  }),
}));

// Device Metrics Table (time-series data)
export const DeviceMetrics = pgTable('deviceMetrics', {
  deviceId: varchar('deviceId', { length: 128 })
    .references(() => Devices.id, { onDelete: 'cascade' })
    .notNull(),
  id: varchar('id', { length: 128 })
    .$defaultFn(() => createId({ prefix: 'metric' }))
    .notNull()
    .primaryKey(),

  metricType: text('metricType').notNull(),

  timestamp: timestamp('timestamp', {
    mode: 'date',
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  unit: text('unit'),
  value: json('value').notNull(),
});

export type DeviceMetricType = typeof DeviceMetrics.$inferSelect;
export const CreateDeviceMetricSchema = createInsertSchema(DeviceMetrics).omit({
  id: true,
});

export const DeviceMetricsRelations = relations(DeviceMetrics, ({ one }) => ({
  device: one(Devices, {
    fields: [DeviceMetrics.deviceId],
    references: [Devices.id],
  }),
}));

// Device Commands Table (for hub daemon command queue)
export const commandStatusEnum = pgEnum('commandStatus', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const CommandStatusType = z.enum(commandStatusEnum.enumValues).enum;

export const DeviceCommands = pgTable('deviceCommands', {
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

export type DeviceCommandType = typeof DeviceCommands.$inferSelect;
export const CreateDeviceCommandSchema = createInsertSchema(
  DeviceCommands,
).omit({
  createdAt: true,
  id: true,
  userId: true,
});

export const DeviceCommandsRelations = relations(DeviceCommands, ({ one }) => ({
  device: one(Devices, {
    fields: [DeviceCommands.deviceId],
    references: [Devices.id],
  }),
  user: one(Users, {
    fields: [DeviceCommands.userId],
    references: [Users.id],
  }),
}));

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

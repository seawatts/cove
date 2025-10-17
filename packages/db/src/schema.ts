import { createId } from '@cove/id';
import { relations } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

// ===================================
// Enums
// ===================================
export const userRole = pgEnum('userRole', [
  'OWNER',
  'ADULT',
  'CHILD',
  'GUEST',
  'SERVICE',
]);
export const homeMode = pgEnum('homeMode', [
  'HOME',
  'AWAY',
  'SLEEP',
  'VACATION',
  'GUEST',
  'CUSTOM',
]);

// ===================================
// User & Home Management
// ===================================

export const home = pgTable('home', {
  address: jsonb('address'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: text('createdBy').references((): AnyPgColumn => users.id),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'home' }))
    .notNull()
    .primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('America/Los_Angeles'),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===================================
// Topology: floors / rooms / devices / entities
// ===================================

export const floor = pgTable(
  'floor',
  {
    homeId: text('homeId')
      .notNull()
      .references(() => home.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'floor' }))
      .notNull()
      .primaryKey(),
    level: integer('index').notNull(),
    name: text('name'),
  },
  (t) => [unique('floorUnique').on(t.homeId, t.level)],
);

export const room = pgTable(
  'room',
  {
    floorId: text('floorId').references(() => floor.id, {
      onDelete: 'set null',
    }),
    homeId: text('homeId')
      .notNull()
      .references(() => home.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'room' }))
      .notNull()
      .primaryKey(),
    name: text('name').notNull(),
  },
  (t) => [unique('roomUnique').on(t.homeId, t.name)],
);

export const device = pgTable(
  'device',
  {
    config: jsonb('config').$type<Record<string, unknown>>(),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    homeId: text('homeId')
      .notNull()
      .references(() => home.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'device' }))
      .notNull()
      .primaryKey(),
    ipAddress: inet('ipAddress'),
    lastSeen: timestamp('lastSeen', { withTimezone: true }),
    manufacturer: text('manufacturer'),
    matterNodeId: bigint('matterNodeId', { mode: 'number' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    model: text('model'),
    name: text('name').notNull(),
    online: boolean('online').notNull().default(false),
    roomId: text('roomId').references(() => room.id, {
      onDelete: 'set null',
    }),
    state: jsonb('state').$type<Record<string, unknown>>(),
    swVersion: text('swVersion'),
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    viaDeviceId: text('viaDeviceId').references((): AnyPgColumn => device.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('device_homeId_idx').on(t.homeId),
    index('device_roomId_idx').on(t.roomId),
    index('device_matterNodeId_idx').on(t.matterNodeId),
    index('device_updatedAt_idx').on(t.updatedAt),
  ],
);

export const entity = pgTable(
  'entity',
  {
    deviceId: text('deviceId')
      .notNull()
      .references(() => device.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'entity' }))
      .notNull()
      .primaryKey(),
    key: text('key').notNull().unique(), // e.g. 'light.kitchen'
    kind: text('kind').notNull(), // 'light','sensor','lock',...
    traits: jsonb('traits').notNull(), // capabilities JSON
  },
  (t) => [
    index('entity_deviceId_idx').on(t.deviceId),
    index('entity_kind_idx').on(t.kind),
  ],
);

// ===================================
// Runtime: latest snapshot
// ===================================

export const entityState = pgTable('entityState', {
  attrs: jsonb('attrs'),
  entityId: text('entityId')
    .primaryKey()
    .references(() => entity.id, { onDelete: 'cascade' }),
  state: text('state').notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===================================
// Runtime: history (Timescale hypertable)
// ===================================

export const entityStateHistory = pgTable(
  'entityStateHistory',
  {
    attrs: jsonb('attrs'),
    entityId: text('entityId')
      .notNull()
      .references(() => entity.id, { onDelete: 'cascade' }),
    homeId: text('homeId')
      .notNull()
      .references(() => home.id, { onDelete: 'cascade' }),
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    state: text('state').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('entityStateHistory_entityId_ts_idx').on(t.entityId, t.ts.desc()),
    index('entityStateHistory_homeId_ts_idx').on(t.homeId, t.ts.desc()),
    index('entityStateHistory_ts_idx').on(t.ts.desc()),
  ],
);
// NOTE: Timescale transforms this table with create_hypertable() in SQL migration.

// ===================================
// Events (non-state)
// ===================================

export const eventType = pgTable('eventType', {
  eventType: text('eventType').notNull().unique(),
  id: smallint('id').primaryKey().default(1), // serial smallint
});

export const eventPayload = pgTable('eventPayload', {
  body: jsonb('body').notNull(),
  hash: bigint('hash', { mode: 'number' }).unique(),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
});

export const event = pgTable(
  'event',
  {
    contextId: text('contextId'),
    eventTypeId: smallint('eventTypeId')
      .notNull()
      .references(() => eventType.id),
    homeId: text('homeId')
      .notNull()
      .references(() => home.id, { onDelete: 'cascade' }),
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    originIdx: smallint('originIdx'),
    payloadId: bigint('payloadId', { mode: 'number' }).references(
      () => eventPayload.id,
    ),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('event_homeId_ts_idx').on(t.homeId, t.ts.desc()),
    index('event_eventTypeId_ts_idx').on(t.eventTypeId, t.ts.desc()),
    index('event_ts_idx').on(t.ts.desc()),
  ],
);

// ===================================
// Scenes & Automations (versioned)
// ===================================

export const mode = pgTable(
  'mode',
  {
    homeId: text('homeId')
      .notNull()
      .references(() => home.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'mode' }))
      .notNull()
      .primaryKey(),
    key: homeMode('key').notNull(),
    policy: jsonb('policy'),
  },
  (t) => [unique('modeUnique').on(t.homeId, t.key)],
);

export const scene = pgTable('scene', {
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: text('createdBy').references(() => users.id),
  homeId: text('homeId')
    .notNull()
    .references(() => home.id, { onDelete: 'cascade' }),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'scene' }))
    .notNull()
    .primaryKey(),
  name: text('name').notNull(),
  userId: text('userId').references(() => users.id),
});

export const sceneVersion = pgTable(
  'sceneVersion',
  {
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    homeId: text('homeId')
      .notNull()
      .references(() => home.id, { onDelete: 'cascade' }),
    note: text('note'),
    sceneId: text('sceneId')
      .notNull()
      .references(() => scene.id, { onDelete: 'cascade' }),
    sceneVersionId: text('sceneVersionId')
      .$defaultFn(() => createId({ prefix: 'sceneVersion' }))
      .notNull()
      .primaryKey(),
    steps: jsonb('steps').notNull(), // [{entityId,state,attrs}]
    version: integer('version').notNull(),
  },
  (t) => [unique('sceneVersionUnique').on(t.sceneId, t.version)],
);

export const automation = pgTable('automation', {
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: text('createdBy').references(() => users.id),
  enabled: boolean('enabled').notNull().default(true),
  homeId: text('homeId')
    .notNull()
    .references(() => home.id, { onDelete: 'cascade' }),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'automation' }))
    .notNull()
    .primaryKey(),
  lastActivated: timestamp('lastActivated', { withTimezone: true }),
  name: text('name').notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  userId: text('userId').references(() => users.id),
});

export const automationVersion = pgTable(
  'automationVersion',
  {
    automationId: text('automationId')
      .notNull()
      .references(() => automation.id, { onDelete: 'cascade' }),
    automationVersionId: text('automationVersionId')
      .$defaultFn(() => createId({ prefix: 'automationVersion' }))
      .notNull()
      .primaryKey(),
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    graph: jsonb('graph').notNull(), // typed in TS with Zod; stored as JSONB
    homeId: text('homeId')
      .notNull()
      .references(() => home.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
  },
  (t) => [unique('automationVersionUnique').on(t.automationId, t.version)],
);

export const automationTrace = pgTable(
  'automationTrace',
  {
    automationId: text('automationId')
      .notNull()
      .references(() => automation.id, { onDelete: 'cascade' }),
    finishedAt: timestamp('finishedAt', { withTimezone: true }),
    homeId: text('homeId')
      .notNull()
      .references(() => home.id, { onDelete: 'cascade' }),
    runId: text('runId')
      .$defaultFn(() => createId({ prefix: 'run' }))
      .notNull(),
    spans: jsonb('spans'),
    startedAt: timestamp('startedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text('status').notNull().default('running'),
    traceId: text('traceId')
      .$defaultFn(() => createId({ prefix: 'trace' }))
      .notNull()
      .primaryKey(),
    version: integer('version').notNull(),
  },
  (t) => [unique('traceIdUnique').on(t.traceId)],
);

// ===================================
// User Management
// ===================================

export const users = pgTable('users', {
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  email: text('email').notNull().unique(),
  firstName: text('firstName'),
  homeId: text('homeId').references(() => home.id, {
    onDelete: 'set null',
  }),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'user' }))
    .notNull()
    .primaryKey(),
  imageUrl: text('imageUrl'),
  lastName: text('lastName'),
  role: userRole('role').notNull().default('ADULT'),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===================================
// Relations
// ===================================

export const homeRelations = relations(home, ({ many }) => ({
  automations: many(automation),
  devices: many(device),
  events: many(event),
  floors: many(floor),
  modes: many(mode),
  rooms: many(room),
  scenes: many(scene),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  createdAutomations: many(automation),
  createdScenes: many(scene),
  home: one(home, {
    fields: [users.homeId],
    references: [home.id],
  }),
}));

export const floorRelations = relations(floor, ({ one, many }) => ({
  home: one(home, {
    fields: [floor.homeId],
    references: [home.id],
  }),
  rooms: many(room),
}));

export const roomRelations = relations(room, ({ one, many }) => ({
  devices: many(device),
  floor: one(floor, {
    fields: [room.floorId],
    references: [floor.id],
  }),
  home: one(home, {
    fields: [room.homeId],
    references: [home.id],
  }),
}));

export const deviceRelations = relations(device, ({ one, many }) => ({
  entities: many(entity),
  home: one(home, {
    fields: [device.homeId],
    references: [home.id],
  }),
  room: one(room, {
    fields: [device.roomId],
    references: [room.id],
  }),
  viaDevice: one(device, {
    fields: [device.viaDeviceId],
    references: [device.id],
    relationName: 'viaDevice',
  }),
}));

export const entityRelations = relations(entity, ({ one, many }) => ({
  device: one(device, {
    fields: [entity.deviceId],
    references: [device.id],
  }),
  state: one(entityState),
  stateHistory: many(entityStateHistory),
}));

export const entityStateRelations = relations(entityState, ({ one }) => ({
  entity: one(entity, {
    fields: [entityState.entityId],
    references: [entity.id],
  }),
}));

export const entityStateHistoryRelations = relations(
  entityStateHistory,
  ({ one }) => ({
    entity: one(entity, {
      fields: [entityStateHistory.entityId],
      references: [entity.id],
    }),
  }),
);

export const eventTypeRelations = relations(eventType, ({ many }) => ({
  events: many(event),
}));

export const eventPayloadRelations = relations(eventPayload, ({ many }) => ({
  events: many(event),
}));

export const eventRelations = relations(event, ({ one }) => ({
  eventType: one(eventType, {
    fields: [event.eventTypeId],
    references: [eventType.id],
  }),
  home: one(home, {
    fields: [event.homeId],
    references: [home.id],
  }),
  payload: one(eventPayload, {
    fields: [event.payloadId],
    references: [eventPayload.id],
  }),
}));

export const modeRelations = relations(mode, ({ one }) => ({
  home: one(home, {
    fields: [mode.id],
    references: [home.id],
  }),
}));

export const sceneRelations = relations(scene, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [scene.createdBy],
    references: [users.id],
  }),
  home: one(home, {
    fields: [scene.homeId],
    references: [home.id],
  }),
  versions: many(sceneVersion),
}));

export const sceneVersionRelations = relations(sceneVersion, ({ one }) => ({
  scene: one(scene, {
    fields: [sceneVersion.sceneId],
    references: [scene.id],
  }),
}));

export const automationRelations = relations(automation, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [automation.createdBy],
    references: [users.id],
  }),
  home: one(home, {
    fields: [automation.homeId],
    references: [home.id],
  }),
  traces: many(automationTrace),
  versions: many(automationVersion),
}));

export const automationVersionRelations = relations(
  automationVersion,
  ({ one }) => ({
    automation: one(automation, {
      fields: [automationVersion.automationId],
      references: [automation.id],
    }),
  }),
);

// ===================================
// API & Organization Management
// ===================================

export const orgs = pgTable('orgs', {
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'org' }))
    .notNull()
    .primaryKey(),
  name: text('name').notNull(),
  stripeCustomerId: text('stripeCustomerId'),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orgMembers = pgTable('orgMembers', {
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'org_member' }))
    .notNull()
    .primaryKey(),
  orgId: text('orgId')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('MEMBER'),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const apiKeys = pgTable('apiKeys', {
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'api_key' }))
    .notNull()
    .primaryKey(),
  isActive: boolean('isActive').notNull().default(true),
  key: text('key').notNull().unique(),
  lastUsedAt: timestamp('lastUsedAt', { withTimezone: true }),
  name: text('name').notNull(),
  orgId: text('orgId')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const apiKeyUsage = pgTable('apiKeyUsage', {
  apiKeyId: text('apiKeyId')
    .notNull()
    .references(() => apiKeys.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  endpoint: text('endpoint').notNull(),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'api_key_usage' }))
    .notNull()
    .primaryKey(),
  method: text('method').notNull(),
  orgId: text('orgId')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp', { withTimezone: true })
    .notNull()
    .defaultNow(),
  type: text('type').notNull().default('api'),
});

export const authCodes = pgTable('authCodes', {
  code: text('code').notNull().unique(),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'auth_code' }))
    .notNull()
    .primaryKey(),
  orgId: text('orgId').references(() => orgs.id, { onDelete: 'cascade' }),
  sessionId: text('sessionId'),
  usedAt: timestamp('usedAt', { withTimezone: true }),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const widgetPreferences = pgTable('widgetPreferences', {
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'widget_pref' }))
    .notNull()
    .primaryKey(),
  preferences: jsonb('preferences').notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  widgetType: text('widgetType').notNull(),
});

export const automationTraceRelations = relations(
  automationTrace,
  ({ one }) => ({
    automation: one(automation, {
      fields: [automationTrace.automationId],
      references: [automation.id],
    }),
  }),
);

// ===================================
// Stub Tables for API Compatibility
// ===================================

export const deviceCommands = pgTable('deviceCommands', {
  command: text('command').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deviceId: text('deviceId').references(() => device.id),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'cmd' }))
    .notNull()
    .primaryKey(),
});

export const commands = pgTable('commands', {
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'cmd' }))
    .notNull()
    .primaryKey(),
  name: text('name').notNull(),
});

// ===================================
// Type Exports for API Package
// ===================================

export type ApiKeyType = typeof apiKeys.$inferSelect;
export type OrgType = typeof orgs.$inferSelect;
export type OrgMembersType = typeof orgMembers.$inferSelect;
export type UserType = typeof users.$inferSelect;

// ===================================
// Zod Schema Exports
// ===================================

import { createInsertSchema } from 'drizzle-zod';

export const CreateApiKeySchema = createInsertSchema(apiKeys).omit({
  createdAt: true,
  id: true,
});
export const CreateApiKeyUsageSchema = createInsertSchema(apiKeyUsage).omit({
  id: true,
});
export const CreateUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  id: true,
});

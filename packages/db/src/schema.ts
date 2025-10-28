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
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import type { EntityCapability } from './types';

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

export const entityKind = pgEnum('entityKind', [
  'alarm_control_panel',
  'binary_sensor',
  'button',
  'camera',
  'climate',
  'color',
  'cover',
  'date',
  'datetime',
  'event',
  'fan',
  'light',
  'lock',
  'media_player',
  'number',
  'outlet',
  'select',
  'sensor',
  'siren',
  'speaker',
  'switch',
  'text',
  'text_sensor',
  'thermostat',
  'time',
  'update',
  'valve',
  'other',
]);

// ===================================
// User & Home Management
// ===================================

export const homes = pgTable('homes', {
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

export const rooms = pgTable(
  'rooms',
  {
    floor: integer('floor'),
    homeId: text('homeId')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'room' }))
      .notNull()
      .primaryKey(),
    name: text('name').notNull(),
  },
  (t) => [unique('roomUnique').on(t.homeId, t.name)],
);

export const devices = pgTable(
  'devices',
  {
    // Status tracking
    available: boolean('available').notNull().default(true), // Different from online
    categories: jsonb('categories').$type<string[]>().default([]), // ['lighting', 'security', etc.]
    configUrl: text('configUrl'), // Link to device config interface

    // Existing fields
    createdAt: timestamp('createdAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    disabledBy: text('disabledBy'), // 'user', 'integration', 'config_entry'
    entryType: text('entryType').default('device'), // 'device' or 'service'
    externalId: text('externalId'), // For deduplication (MAC, serial, etc.)
    homeId: text('homeId')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    hostname: text('hostname'),

    // Hardware/software versions
    hwVersion: text('hwVersion'),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'device' }))
      .notNull()
      .primaryKey(),
    ipAddress: inet('ipAddress'),
    lastSeen: timestamp('lastSeen', { withTimezone: true }),

    // Network info (keep simple, flatten common fields)
    macAddress: text('macAddress'),
    manufacturer: text('manufacturer'),
    matterNodeId: bigint('matterNodeId', { mode: 'number' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(), // Now for protocol-specific only
    model: text('model'),
    name: text('name').notNull(),
    online: boolean('online').notNull().default(false),
    port: integer('port'),
    // Core identification & protocol
    protocol: text('protocol').notNull(), // 'esphome', 'hue', 'matter', 'sonos', etc.
    roomId: text('roomId').references(() => rooms.id, {
      onDelete: 'set null',
    }),
    swVersion: text('swVersion'),
    type: text('type'), // 'light', 'sensor', 'hub', 'speaker', etc.
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .notNull()
      .defaultNow(),
    viaDeviceId: text('viaDeviceId').references((): AnyPgColumn => devices.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('devices_homeId_idx').on(t.homeId),
    index('devices_roomId_idx').on(t.roomId),
    index('devices_matterNodeId_idx').on(t.matterNodeId),
    index('devices_updatedAt_idx').on(t.updatedAt),
    index('devices_protocol_idx').on(t.protocol),
    index('devices_externalId_idx').on(t.externalId),
    index('devices_type_idx').on(t.type),
    index('devices_macAddress_idx').on(t.macAddress),
    index('devices_online_idx').on(t.online),
    index('devices_available_idx').on(t.available),
  ],
);

export const entities = pgTable(
  'entities',
  {
    capabilities: jsonb('capabilities')
      .$type<EntityCapability[]>()
      .notNull()
      .default([]), // rich capability objects with units
    deviceClass: text('deviceClass'), // 'temperature', 'motion', 'co2', etc.
    deviceId: text('deviceId')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'entity' }))
      .notNull()
      .primaryKey(),
    key: text('key').notNull().unique(), // e.g. 'light.kitchen'
    kind: entityKind('kind').notNull(), // 'light','sensor','lock',...
    name: text('name'), // Friendly display name from protocol adapters
  },
  (t) => [
    index('entities_deviceId_idx').on(t.deviceId),
    index('entities_kind_idx').on(t.kind),
    index('entities_deviceClass_idx').on(t.deviceClass), // NEW index
  ],
);

// ===================================
// Runtime: latest snapshot
// ===================================

export const entityStates = pgTable('entityStates', {
  attrs: jsonb('attrs'),
  entityId: text('entityId')
    .primaryKey()
    .references(() => entities.id, { onDelete: 'cascade' }),
  state: text('state').notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===================================
// Runtime: history
// ===================================

export const entityStateHistories = pgTable(
  'entityStateHistories',
  {
    attrs: jsonb('attrs'),
    entityId: text('entityId')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    homeId: text('homeId')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    id: bigserial('id', { mode: 'number' }).notNull(),
    state: text('state').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('entityStateHistories_entityId_ts_idx').on(t.entityId, t.ts.desc()),
    index('entityStateHistories_homeId_ts_idx').on(t.homeId, t.ts.desc()),
    index('entityStateHistories_ts_idx').on(t.ts.desc()),
  ],
);

// ===================================
// Events (non-state)
// ===================================

export const events = pgTable(
  'events',
  {
    deviceId: text('deviceId').references(() => devices.id, {
      onDelete: 'set null',
    }),
    entityId: text('entityId').references(() => entities.id, {
      onDelete: 'set null',
    }),
    eventType: text('eventType').notNull(), // Direct string, no FK
    homeId: text('homeId')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    id: bigserial('id', { mode: 'number' }).notNull(),
    message: text('message').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(), // Combined payload
    ts: timestamp('ts', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('events_homeId_ts_idx').on(t.homeId, t.ts.desc()),
    index('events_eventType_ts_idx').on(t.eventType, t.ts.desc()),
    index('events_ts_idx').on(t.ts.desc()),
    index('events_entityId_idx').on(t.entityId),
    index('events_deviceId_idx').on(t.deviceId),
  ],
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
  homeId: text('homeId').references(() => homes.id, {
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

export const homeRelations = relations(homes, ({ many }) => ({
  devices: many(devices),
  events: many(events),
  rooms: many(rooms),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  home: one(homes, {
    fields: [users.homeId],
    references: [homes.id],
  }),
}));

export const roomRelations = relations(rooms, ({ one, many }) => ({
  devices: many(devices),
  home: one(homes, {
    fields: [rooms.homeId],
    references: [homes.id],
  }),
}));

export const deviceRelations = relations(devices, ({ one, many }) => ({
  entities: many(entities),
  home: one(homes, {
    fields: [devices.homeId],
    references: [homes.id],
  }),
  room: one(rooms, {
    fields: [devices.roomId],
    references: [rooms.id],
  }),
  viaDevice: one(devices, {
    fields: [devices.viaDeviceId],
    references: [devices.id],
    relationName: 'viaDevice',
  }),
}));

export const entityRelations = relations(entities, ({ one, many }) => ({
  device: one(devices, {
    fields: [entities.deviceId],
    references: [devices.id],
  }),
  state: one(entityStates),
  stateHistory: many(entityStateHistories),
}));

export const entityStateRelations = relations(entityStates, ({ one }) => ({
  entity: one(entities, {
    fields: [entityStates.entityId],
    references: [entities.id],
  }),
}));

export const entityStateHistoryRelations = relations(
  entityStateHistories,
  ({ one }) => ({
    entity: one(entities, {
      fields: [entityStateHistories.entityId],
      references: [entities.id],
    }),
  }),
);

export const eventRelations = relations(events, ({ one }) => ({
  device: one(devices, {
    fields: [events.deviceId],
    references: [devices.id],
  }),
  entity: one(entities, {
    fields: [events.entityId],
    references: [entities.id],
  }),
  home: one(homes, {
    fields: [events.homeId],
    references: [homes.id],
  }),
}));

import { createId } from '@cove/id';
import { relations } from 'drizzle-orm';
import {
  blob,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

// ===================================
// User & Home Management (keeping existing structure)
// ===================================

export const homes = sqliteTable('homes', {
  address: blob('address', { mode: 'json' }),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  createdBy: text('createdBy'),
  id: text('id')
    .$defaultFn(() => createId({ prefix: 'home' }))
    .notNull()
    .primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('America/Los_Angeles'),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const rooms = sqliteTable(
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

export const users = sqliteTable('users', {
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
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
  role: text('role').notNull().default('ADULT'),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ===================================
// Core Home Automation Schema (from ha-pro.md)
// ===================================

export const devices = sqliteTable(
  'devices',
  {
    bridgeId: text('bridgeId'), // e.g., zigbee/matter bridge device
    fingerprint: text('fingerprint').unique(), // stable identifier from driver (MAC, eUID, etc.)
    homeId: text('homeId')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'device' }))
      .notNull()
      .primaryKey(),
    ip: text('ip'), // for IP devices/bridges
    lastSeen: integer('lastSeen', { mode: 'timestamp' }),
    model: text('model'),
    name: text('name'),
    pairedAt: integer('pairedAt', { mode: 'timestamp' }),
    protocol: text('protocol').notNull(), // "hue", "lifx", "esphome", "matter", "zigbee", "ble"
    roomId: text('roomId').references(() => rooms.id, {
      onDelete: 'set null',
    }),
    vendor: text('vendor').notNull(),
  },
  (t) => [
    index('devices_protocol_idx').on(t.protocol),
    index('devices_fingerprint_idx').on(t.fingerprint),
    index('devices_homeId_idx').on(t.homeId),
    index('devices_roomId_idx').on(t.roomId),
    index('devices_lastSeen_idx').on(t.lastSeen),
  ],
);

export const entities = sqliteTable(
  'entities',
  {
    capability: blob('capability', { mode: 'json' }).notNull(), // schema of supported features
    deviceId: text('deviceId')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    homeId: text('homeId')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'entity' }))
      .notNull()
      .primaryKey(),
    key: text('key'), // driver-specific identifier (e.g., ESPHome key)
    kind: text('kind').notNull(), // "light", "switch", "sensor", "button", ...
    name: text('name'),
  },
  (t) => [
    unique('entityDeviceName').on(t.deviceId, t.name),
    index('entities_deviceId_idx').on(t.deviceId),
    index('entities_homeId_idx').on(t.homeId),
    index('entities_key_idx').on(t.key),
    index('entities_kind_idx').on(t.kind),
  ],
);

export const entityState = sqliteTable('entityState', {
  entityId: text('entityId')
    .primaryKey()
    .references(() => entities.id, { onDelete: 'cascade' }),
  state: blob('state', { mode: 'json' }).notNull(), // normalized state (e.g., {"on":true,"brightness":72})
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const telemetry = sqliteTable(
  'telemetry',
  {
    entityId: text('entityId')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    field: text('field').notNull(), // e.g., "temperature", "co2", "power_w"
    homeId: text('homeId')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    ts: integer('ts', { mode: 'timestamp' }).notNull(), // epoch ms
    unit: text('unit'), // "C", "ppm", "W"
    value: integer('value'), // REAL in SQLite
  },
  (t) => [
    index('telemetry_entityId_ts_field').on(t.entityId, t.ts, t.field),
    index('telemetry_homeId_idx').on(t.homeId),
    index('telemetry_ts_idx').on(t.ts),
    index('telemetry_field_idx').on(t.field),
  ],
);

export const credentials = sqliteTable('credentials', {
  blob: blob('blob').notNull(), // encrypted at rest
  deviceId: text('deviceId')
    .primaryKey()
    .references(() => devices.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // "hue_token", "nanoleaf_token", "hap_pairing", etc.
});

// ===================================
// Relations
// ===================================

export const homeRelations = relations(homes, ({ many }) => ({
  devices: many(devices),
  entities: many(entities),
  rooms: many(rooms),
  telemetry: many(telemetry),
  users: many(users),
}));

export const roomRelations = relations(rooms, ({ one, many }) => ({
  devices: many(devices),
  home: one(homes, {
    fields: [rooms.homeId],
    references: [homes.id],
  }),
}));

export const userRelations = relations(users, ({ one }) => ({
  home: one(homes, {
    fields: [users.homeId],
    references: [homes.id],
  }),
}));

export const deviceRelations = relations(devices, ({ one, many }) => ({
  credentials: one(credentials),
  entities: many(entities),
  home: one(homes, {
    fields: [devices.homeId],
    references: [homes.id],
  }),
  room: one(rooms, {
    fields: [devices.roomId],
    references: [rooms.id],
  }),
}));

export const entityRelations = relations(entities, ({ one, many }) => ({
  device: one(devices, {
    fields: [entities.deviceId],
    references: [devices.id],
  }),
  home: one(homes, {
    fields: [entities.homeId],
    references: [homes.id],
  }),
  state: one(entityState),
  telemetry: many(telemetry),
}));

export const entityStateRelations = relations(entityState, ({ one }) => ({
  entity: one(entities, {
    fields: [entityState.entityId],
    references: [entities.id],
  }),
}));

export const telemetryRelations = relations(telemetry, ({ one }) => ({
  entity: one(entities, {
    fields: [telemetry.entityId],
    references: [entities.id],
  }),
  home: one(homes, {
    fields: [telemetry.homeId],
    references: [homes.id],
  }),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  device: one(devices, {
    fields: [credentials.deviceId],
    references: [devices.id],
  }),
}));

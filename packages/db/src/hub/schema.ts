/**
 * Hub SQLite Database Schema
 * Local database for home automation hub (moved from apps/hub)
 *
 * This is separate from the main Supabase schema and uses SQLite for local storage
 * on the hub device.
 */

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
    deviceClass: text('deviceClass'), // e.g., "temperature", "co2", "humidity", "signal_strength"
    deviceId: text('deviceId')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    displayName: text('displayName'), // Custom user-defined display name
    homeId: text('homeId')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'entity' }))
      .notNull()
      .primaryKey(),
    isFavorite: integer('isFavorite', { mode: 'boolean' })
      .notNull()
      .default(false), // User favorite flag
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
    index('entities_isFavorite_idx').on(t.isFavorite),
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

export const telemetryConfig = sqliteTable(
  'telemetryConfig',
  {
    changeThreshold: integer('changeThreshold'), // Minimum change required to record (for numeric values). If null, exact match only.
    entityId: text('entityId')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    field: text('field'), // If null, applies to all fields for this entity. Otherwise, field-specific config.
    minimumInterval: integer('minimumInterval'), // Minimum time between recordings (ms). If null, uses default.
    updatedAt: integer('updatedAt', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    unique('telemetryConfig_entityId_field').on(t.entityId, t.field),
    index('telemetryConfig_entityId_idx').on(t.entityId),
  ],
);

// ===================================
// Alert System
// ===================================

export const alertConfigs = sqliteTable(
  'alertConfigs',
  {
    alertType: text('alertType').notNull(), // 'threshold', 'range', 'rate_of_change'
    createdAt: integer('createdAt', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    entityId: text('entityId')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    field: text('field').notNull(), // telemetry field to monitor (e.g., "co2", "temperature")
    homeId: text('homeId')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'alert_config' }))
      .notNull()
      .primaryKey(),
    name: text('name').notNull(),
    // Range config (for range alerts)
    rangeMax: integer('rangeMax'), // maximum value for range
    rangeMin: integer('rangeMin'), // minimum value for range
    // Rate of change config (for rate_of_change alerts)
    rateThreshold: integer('rateThreshold'), // rate of change threshold
    rateWindow: integer('rateWindow'), // time window in ms
    severity: text('severity').notNull(), // 'info', 'warning', 'critical'
    showInGraph: integer('showInGraph', { mode: 'boolean' })
      .notNull()
      .default(true), // whether to display this alert on the graph
    // Threshold config (for threshold alerts)
    thresholdOperator: text('thresholdOperator'), // 'gt', 'lt', 'gte', 'lte'
    thresholdValue: integer('thresholdValue'), // numeric threshold
    updatedAt: integer('updatedAt', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('alertConfigs_entityId_idx').on(t.entityId),
    index('alertConfigs_homeId_idx').on(t.homeId),
    index('alertConfigs_enabled_idx').on(t.enabled),
    index('alertConfigs_severity_idx').on(t.severity),
  ],
);

export const alertHistory = sqliteTable(
  'alertHistory',
  {
    acknowledged: integer('acknowledged', { mode: 'boolean' })
      .notNull()
      .default(false),
    alertConfigId: text('alertConfigId')
      .notNull()
      .references(() => alertConfigs.id, { onDelete: 'cascade' }),
    entityId: text('entityId')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    homeId: text('homeId')
      .notNull()
      .references(() => homes.id, { onDelete: 'cascade' }),
    id: text('id')
      .$defaultFn(() => createId({ prefix: 'alert_event' }))
      .notNull()
      .primaryKey(),
    message: text('message').notNull(),
    resolvedAt: integer('resolvedAt', { mode: 'timestamp' }),
    severity: text('severity').notNull(),
    threshold: integer('threshold'), // threshold that was crossed (if applicable)
    triggeredAt: integer('triggeredAt', { mode: 'timestamp' }).notNull(),
    value: integer('value').notNull(), // value that triggered the alert
  },
  (t) => [
    index('alertHistory_alertConfigId_idx').on(t.alertConfigId),
    index('alertHistory_entityId_idx').on(t.entityId),
    index('alertHistory_homeId_idx').on(t.homeId),
    index('alertHistory_triggeredAt_idx').on(t.triggeredAt),
    index('alertHistory_severity_idx').on(t.severity),
    index('alertHistory_acknowledged_idx').on(t.acknowledged),
    index('alertHistory_resolvedAt_idx').on(t.resolvedAt),
  ],
);

// ===================================
// Relations
// ===================================

export const homeRelations = relations(homes, ({ many }) => ({
  alertConfigs: many(alertConfigs),
  alertHistory: many(alertHistory),
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
  alertConfigs: many(alertConfigs),
  alertHistory: many(alertHistory),
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
  telemetryConfig: many(telemetryConfig),
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

export const telemetryConfigRelations = relations(
  telemetryConfig,
  ({ one }) => ({
    entity: one(entities, {
      fields: [telemetryConfig.entityId],
      references: [entities.id],
    }),
  }),
);

export const alertConfigRelations = relations(
  alertConfigs,
  ({ one, many }) => ({
    entity: one(entities, {
      fields: [alertConfigs.entityId],
      references: [entities.id],
    }),
    history: many(alertHistory),
    home: one(homes, {
      fields: [alertConfigs.homeId],
      references: [homes.id],
    }),
  }),
);

export const alertHistoryRelations = relations(alertHistory, ({ one }) => ({
  alertConfig: one(alertConfigs, {
    fields: [alertHistory.alertConfigId],
    references: [alertConfigs.id],
  }),
  entity: one(entities, {
    fields: [alertHistory.entityId],
    references: [entities.id],
  }),
  home: one(homes, {
    fields: [alertHistory.homeId],
    references: [homes.id],
  }),
}));

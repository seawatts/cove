Perfect—here’s a tight, production-ready setup for Drizzle (Postgres) with TimescaleDB for the hot+history split we designed.

I’ll give you:
	1.	Drizzle table models (TS)
	2.	SQL migrations to enable Timescale, convert entity_state_history into a hypertable, add retention + compression + a continuous aggregate
	3.	A few ergonomic Drizzle snippets (reads/writes)

⸻

1) Drizzle schema (TypeScript)

Keep the latest in a narrow entity_state row, and push history into a Timescale hypertable (entity_state_history). Everything else is vanilla Postgres tables—Drizzle can model them normally.

// db/schema.ts
import {
  pgTable, uuid, text, jsonb, timestamp, pgEnum, primaryKey, inet,
  smallint, integer, bigserial, bigInt, bytea, unique, serial
} from "drizzle-orm/pg-core";

// --- Enums -------------------------------------------------------------------
export const userRole = pgEnum('user_role', ['owner','adult','child','guest','service']);
export const homeMode = pgEnum('home_mode', ['HOME','AWAY','SLEEP','VACATION','GUEST','CUSTOM']);

// --- Homes / Households / Users ----------------------------------------------
export const home = pgTable('home', {
  homeId: uuid('home_id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('America/Los_Angeles'),
  address: jsonb('address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const household = pgTable('household', {
  householdId: uuid('household_id').primaryKey().defaultRandom(),
  homeId: uuid('home_id').notNull().references(() => home.homeId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appUser = pgTable('app_user', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => household.householdId, { onDelete: 'cascade' }),
  email: text('email').unique(),
  displayName: text('display_name'),
  authProvider: text('auth_provider'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userMembership = pgTable('user_membership', {
  userId: uuid('user_id').primaryKey().references(() => appUser.userId, { onDelete: 'cascade' }),
  role: userRole('role').notNull(),
});

// --- Topology: floors / rooms / devices / entities ---------------------------
export const floor = pgTable('floor', {
  floorId: uuid('floor_id').primaryKey().defaultRandom(),
  homeId: uuid('home_id').notNull().references(() => home.homeId, { onDelete: 'cascade' }),
  index: integer('index').notNull(),
  name: text('name'),
}, (t) => ({
  uniq: unique().on(t.homeId, t.index),
}));

export const room = pgTable('room', {
  roomId: uuid('room_id').primaryKey().defaultRandom(),
  homeId: uuid('home_id').notNull().references(() => home.homeId, { onDelete: 'cascade' }),
  floorId: uuid('floor_id').references(() => floor.floorId, { onDelete: 'set null' }),
  name: text('name').notNull(),
}, (t) => ({
  uniq: unique().on(t.homeId, t.name),
}));

export const device = pgTable('device', {
  deviceId: uuid('device_id').primaryKey().defaultRandom(),
  homeId: uuid('home_id').notNull().references(() => home.homeId, { onDelete: 'cascade' }),
  roomId: uuid('room_id').references(() => room.roomId, { onDelete: 'set null' }),
  name: text('name').notNull(),
  manufacturer: text('manufacturer'),
  model: text('model'),
  swVersion: text('sw_version'),
  viaDeviceId: uuid('via_device_id').references(() => device.deviceId, { onDelete: 'set null' }),
  matterNodeId: bigInt('matter_node_id', { mode: 'number' }),
  ipAddr: inet('ip_addr'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const entity = pgTable('entity', {
  entityId: uuid('entity_id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => device.deviceId, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),                              // 'light','sensor','lock',...
  key: text('key').notNull().unique(),                      // e.g. 'light.kitchen'
  traits: jsonb('traits').notNull(),                        // capabilities JSON
});

// --- Runtime: latest snapshot ------------------------------------------------
export const entityState = pgTable('entity_state', {
  entityId: uuid('entity_id').primaryKey().references(() => entity.entityId, { onDelete: 'cascade' }),
  state: text('state').notNull(),
  attrs: jsonb('attrs'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Runtime: history (Timescale hypertable) ---------------------------------
export const entityStateHistory = pgTable('entity_state_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  entityId: uuid('entity_id').notNull().references(() => entity.entityId, { onDelete: 'cascade' }),
  ts: timestamp('ts', { withTimezone: true }).notNull(),
  state: text('state').notNull(),
  attrs: jsonb('attrs'),
});
// NOTE: Timescale transforms this table with create_hypertable() in SQL migration.

// --- Events (non-state) ------------------------------------------------------
export const eventType = pgTable('event_type', {
  eventTypeId: smallint('event_type_id').primaryKey().default(1 as any), // serial smallint
  eventType: text('event_type').notNull().unique(),
});

export const eventPayload = pgTable('event_payload', {
  payloadId: bigserial('payload_id', { mode: 'number' }).primaryKey(),
  hash: bigInt('hash', { mode: 'number' }).unique(),
  body: jsonb('body').notNull(),
});

export const event = pgTable('event', {
  eventId: bigserial('event_id', { mode: 'number' }).primaryKey(),
  homeId: uuid('home_id').notNull().references(() => home.homeId, { onDelete: 'cascade' }),
  eventTypeId: smallint('event_type_id').notNull().references(() => eventType.eventTypeId),
  ts: timestamp('ts', { withTimezone: true }).notNull(),
  payloadId: bigInt('payload_id', { mode: 'number' }).references(() => eventPayload.payloadId),
  contextId: bytea('context_id'),
  originIdx: smallint('origin_idx'),
});

// --- Scenes & Automations (versioned) ---------------------------------------
export const mode = pgTable('mode', {
  modeId: uuid('mode_id').primaryKey().defaultRandom(),
  homeId: uuid('home_id').notNull().references(() => home.homeId, { onDelete: 'cascade' }),
  key: homeMode('key').notNull(),
  policy: jsonb('policy'),
}, (t) => ({
  uniq: unique().on(t.homeId, t.key),
}));

export const scene = pgTable('scene', {
  sceneId: uuid('scene_id').primaryKey().defaultRandom(),
  homeId: uuid('home_id').notNull().references(() => home.homeId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdBy: uuid('created_by').references(() => appUser.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sceneVersion = pgTable('scene_version', {
  sceneVersionId: uuid('scene_version_id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id').notNull().references(() => scene.sceneId, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  steps: jsonb('steps').notNull(), // [{entityId,state,attrs}]
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.sceneId, t.version),
}));

export const automation = pgTable('automation', {
  automationId: uuid('automation_id').primaryKey().defaultRandom(),
  homeId: uuid('home_id').notNull().references(() => home.homeId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  enabled: text('enabled').notNull().default('true'), // or boolean with drizzle-orm v0.31+
  createdBy: uuid('created_by').references(() => appUser.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const automationVersion = pgTable('automation_version', {
  automationVersionId: uuid('automation_version_id').primaryKey().defaultRandom(),
  automationId: uuid('automation_id').notNull().references(() => automation.automationId, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  graph: jsonb('graph').notNull(), // typed in TS with Zod; stored as JSONB
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.automationId, t.version),
}));

export const automationTrace = pgTable('automation_trace', {
  traceId: uuid('trace_id').primaryKey().defaultRandom(),
  automationId: uuid('automation_id').notNull().references(() => automation.automationId, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  runId: uuid('run_id').notNull().defaultRandom(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull().default('running'),
  spans: jsonb('spans'),
}, (t) => ({
  idx: unique().on(t.traceId),
}));

Drizzle doesn’t “know” about hypertables. That’s fine—create/alter Timescale features via SQL migrations and still use Drizzle models normally.

⸻

2) SQL migrations for TimescaleDB

Create a migration file (e.g. 2025_10_15_timescale.sql) that Drizzle-Kit runs after the tables exist.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Turn history table into a hypertable (time column = ts)
SELECT create_hypertable('entity_state_history', 'ts', if_not_exists => TRUE);

-- Recommended indexes (hypertable-aware)
CREATE INDEX IF NOT EXISTS esh_entity_ts_idx ON entity_state_history (entity_id, ts DESC);
CREATE INDEX IF NOT EXISTS esh_ts_brin ON entity_state_history USING BRIN (ts);

-- Optional: native compression & policy (PG14+ / Timescale 2.x)
-- Good defaults: segment by entity_id, order by ts desc
ALTER TABLE entity_state_history SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'entity_id',
  timescaledb.compress_orderby = 'ts DESC'
);

-- Compress chunks older than 7 days and keep raw 30 days (example)
SELECT add_compression_policy('entity_state_history', INTERVAL '7 days');
SELECT add_retention_policy('entity_state_history', INTERVAL '30 days');

-- Continuous aggregate: hourly rollups (mean/min/max/last state)
-- Materialized view for charts/analytics; refresh policy keeps it up to date.
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_state_hourly
WITH (timescaledb.continuous) AS
SELECT
  entity_id,
  time_bucket('1 hour', ts) AS hour_start,
  avg( NULLIF(state, '')::double precision ) AS mean,
  min( NULLIF(state, '')::double precision ) AS min,
  max( NULLIF(state, '')::double precision ) AS max,
  last( state, ts ) AS last_state
FROM entity_state_history
-- For numeric sensors; non-numeric entities will end up null here.
GROUP BY entity_id, hour_start
WITH NO DATA;

-- Keep the aggregate refreshed and bounded
SELECT add_continuous_aggregate_policy(
  'entity_state_hourly',
  start_offset => INTERVAL '90 days',  -- backfill window
  end_offset   => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes'
);

-- Index the cagg for fast reads
CREATE UNIQUE INDEX IF NOT EXISTS entity_state_hourly_pk
  ON entity_state_hourly (entity_id, hour_start);

Tweak retention & compression to your tastes (e.g., raw for 7–30 days, compressed for 6–24 months). Add more CAGGs (5-minute, daily) as you need.

⸻

3) Drizzle usage patterns

Insert/update latest state, append history

import { db } from './db'; // your drizzle client
import { entityState, entityStateHistory } from './schema';
import { eq } from 'drizzle-orm';

// Upsert latest
export async function setEntityState(entityId: string, state: string, attrs?: any) {
  await db.insert(entityState)
    .values({ entityId, state, attrs })
    .onConflictDoUpdate({
      target: entityState.entityId,
      set: { state, attrs, updatedAt: new Date() }
    });

  // Append to history (Timescale hypertable)
  await db.insert(entityStateHistory)
    .values({ entityId, ts: new Date(), state, attrs });
}

Query latest for a room (“just works” UX)

import { entity, device, room, entityState } from './schema';
import { eq } from 'drizzle-orm';

export async function getRoomTiles(homeId: string, roomName: string) {
  return db.select({
      entityId: entity.entityId,
      key: entity.key,
      kind: entity.kind,
      state: entityState.state,
      attrs: entityState.attrs,
      updatedAt: entityState.updatedAt,
      deviceName: device.name,
    })
    .from(entity)
    .innerJoin(device, eq(entity.deviceId, device.deviceId))
    .innerJoin(room, eq(device.roomId, room.roomId))
    .leftJoin(entityState, eq(entityState.entityId, entity.entityId))
    .where(eq(room.name, roomName));
}

Chart data via continuous aggregate (fast)

import { sql } from 'drizzle-orm';

export async function getHourlySeries(entityId: string, from: Date, to: Date) {
  // Using raw SQL is fine for CAGGs:
  const rows = await db.execute(sql/*sql*/`
    SELECT hour_start, mean, min, max, last_state
    FROM entity_state_hourly
    WHERE entity_id = ${entityId}
      AND hour_start >= ${from}
      AND hour_start <  ${to}
    ORDER BY hour_start ASC
  `);
  return rows;
}


⸻

Practical tips
	•	Write path: Always write latest + history together. UI reads come from entity_state (fast). Charts hit CAGGs.
	•	Data types: In history, state is TEXT to support booleans/literals. Numeric sensors: parse to number on write, or store a parallel value_num column if you want strictness.
	•	Policies: Change add_retention_policy windows to match your product tier (Free: 7d raw; Pro: 30–90d; Enterprise: 1y + compressed).
	•	Compression: You can turn on segment by entity_id (done above). This preserves good compression and query speed per entity.
	•	Backfill: When turning on Timescale late, use WITH NO DATA + refresh_continuous_aggregate to backfill in batches.

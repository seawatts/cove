-- Enable TimescaleDB Extension (Apache License Features Only)
-- This migration adds TimescaleDB support for optimized time-series data storage
-- Benefits:
-- - Automatic data partitioning by time (hypertables)
-- - Fast time-range queries with chunk elimination
-- - Efficient data management
--
-- Note: Supabase uses Apache-licensed TimescaleDB which includes:
-- ✅ Hypertables (partitioning)
-- ✅ Fast time-series queries
-- ❌ Compression (requires commercial license)
-- ❌ Continuous aggregates (requires commercial license)

-- Enable TimescaleDB extension (requires superuser or extension creation privileges)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert states table to a hypertable
-- This automatically partitions data by time (lastChanged column)
-- Chunk interval: 7 days (configurable based on data volume)
SELECT create_hypertable(
  'states',
  'lastChanged',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- Add composite primary key (required for hypertable with unique constraint)
-- Must include partitioning column (lastChanged)
ALTER TABLE "states" ADD CONSTRAINT states_pkey PRIMARY KEY (id, "lastChanged");

-- Create index for entity-based queries (if not exists)
-- This helps with filtering by specific sensors
CREATE INDEX IF NOT EXISTS "states_entity_idx"
  ON "states" ((attributes->>'entityName'), "deviceId", "lastChanged" DESC);

-- Create index for stateKey-based queries (if not exists)
CREATE INDEX IF NOT EXISTS "states_stateKey_idx"
  ON "states" ((attributes->>'stateKey'), "deviceId", "lastChanged" DESC);


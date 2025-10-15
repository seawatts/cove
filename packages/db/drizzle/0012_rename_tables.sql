-- Rename tables to shorter names
-- deviceStateHistory -> states
-- deviceEvents -> events
-- deviceCommands -> commands

-- Rename deviceStateHistory to states
ALTER TABLE "deviceStateHistory" RENAME TO "states";

-- Rename deviceEvents to events
ALTER TABLE "deviceEvents" RENAME TO "events";

-- Rename deviceCommands to commands
ALTER TABLE "deviceCommands" RENAME TO "commands";

-- Drop foreign key constraint from events to states
-- TimescaleDB hypertables cannot have FK constraints pointing to them
-- This is optional reference anyway (events can exist without state history)
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "deviceEvents_stateId_deviceStateHistory_id_fk";

-- Drop primary key constraint from states table
-- TimescaleDB requires composite primary key that includes partitioning column
-- We'll add a new composite PK (id, lastChanged) after creating the hypertable
ALTER TABLE "states" DROP CONSTRAINT IF EXISTS "deviceStateHistory_pkey";
ALTER TABLE "states" DROP CONSTRAINT IF EXISTS "states_pkey";

-- Note: Indexes and constraints are automatically renamed by PostgreSQL
-- Foreign key constraints and triggers are also automatically updated



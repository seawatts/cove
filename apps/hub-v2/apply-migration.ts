#!/usr/bin/env bun
/**
 * Apply pending migrations manually
 * This is useful when the hub is running and you don't want to restart
 */

import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { env } from './src/env';

const dbPath = env.DB_PATH || 'data/hub-v2.db';

console.log(`Applying migrations to database: ${dbPath}`);

const sqlite = new Database(dbPath);
const migrationsFolder = join(import.meta.dir, './drizzle');

try {
  const client = drizzle(sqlite);
  await migrate(client, { migrationsFolder });
  console.log('✓ Migrations applied successfully');
  sqlite.close();
} catch (error) {
  console.error('✗ Failed to apply migrations:', error);
  sqlite.close();
  process.exit(1);
}

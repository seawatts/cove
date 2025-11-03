/**
 * Hub Database Client
 * SQLite database wrapper for the home automation hub
 */

import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { debug, error, warn } from '@cove/logger';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';

const log = debug('cove:db:hub:client');
const logError = error('cove:db:hub:client');
const logWarn = warn('cove:db:hub:client');

// Export the database client type
export type HubDatabaseClient = BunSQLiteDatabase<typeof schema>;

/**
 * Database wrapper class with automatic schema initialization using Drizzle migrator
 * Uses Bun's native SQLite with Drizzle ORM
 */
export class HubDatabaseWrapper {
  private client: HubDatabaseClient;
  private sqlite: Database;
  private initialized = false;

  constructor(dbPath?: string) {
    const path = dbPath || 'hub.db';

    // Create parent directory if it doesn't exist
    const parentDir = dirname(path);
    if (parentDir !== '.') {
      try {
        mkdirSync(parentDir, { recursive: true });
      } catch {
        // Ignore errors - directory might already exist
      }
    }

    this.sqlite = new Database(path);
    this.client = drizzle(this.sqlite, { schema });
  }

  /**
   * Initialize database schema by running migrations
   * This uses Drizzle's migrator to apply migrations from the drizzle folder
   * Based on official Bun docs: https://bun.com/docs/guides/ecosystem/drizzle
   */
  async initialize(migrationsFolder?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Use absolute path for migrations folder relative to this file
    // From packages/db/src/hub/client.ts -> packages/db/drizzle/hub
    const folder =
      migrationsFolder || join(import.meta.dir, '../../drizzle/hub');

    try {
      log('Running migrations from:', folder);
      await migrate(this.client, { migrationsFolder: folder });
      this.initialized = true;
      log('Migrations completed successfully');
    } catch (err) {
      logError('Migration failed:', err);

      // Check if it's a "table already exists" error
      if (err instanceof Error && err.message.includes('already exists')) {
        logError('Tables already exist. You may need to:');
        logError('  1. Delete the database file to start fresh, or');
        logError(
          '  2. Run migrations manually to sync the migration tracking table',
        );
        throw err; // Re-throw to prevent silent failures
      }

      // For other errors, log but don't throw (for development)
      logWarn('Continuing without migrations - this may cause issues');
    }
  }

  /**
   * Get the underlying database client
   */
  getClient(): HubDatabaseClient {
    return this.client;
  }

  /**
   * Get the raw SQLite database instance
   */
  getSQLite(): Database {
    return this.sqlite;
  }

  /**
   * Check if schema is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

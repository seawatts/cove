import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';

// Export the database client type
export type DatabaseClient = BunSQLiteDatabase<typeof schema>;

/**
 * Database wrapper class with automatic schema initialization using Drizzle migrator
 * Uses Bun's native SQLite with Drizzle ORM
 */
export class DatabaseWrapper {
  private client: DatabaseClient;
  private sqlite: Database;
  private initialized = false;

  constructor(dbPath?: string) {
    this.sqlite = new Database(dbPath || 'hub.db');
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
    const folder = migrationsFolder || join(import.meta.dir, '../../drizzle');

    try {
      await migrate(this.client, { migrationsFolder: folder });
      this.initialized = true;
    } catch (error) {
      // If migrations folder doesn't exist or is empty, that's okay for development
      console.warn('Migration failed or no migrations found:', error);
    }
  }

  /**
   * Get the underlying database client
   */
  getClient(): DatabaseClient {
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

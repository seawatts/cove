/**
 * Global test setup for Hub V2 integration tests
 * Provides test fixtures, database helpers, and cleanup utilities
 */

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import type { DatabaseClient } from '../db/client';
import * as schema from '../db/schema';

/**
 * Test database configuration
 */
export interface TestDatabase {
  db: DatabaseClient;
  dbPath: string;
  sqlite: Database;
  cleanup: () => Promise<void>;
}

/**
 * Initialize database tables from schema using Drizzle migrator
 * Uses Bun's native SQLite with Drizzle's migration system
 */
export async function initializeTables(testDb: TestDatabase): Promise<void> {
  try {
    // Use Drizzle's migrator to run migrations on the test database
    // This works with Bun's native SQLite
    await migrate(testDb.db, { migrationsFolder: './drizzle' });
  } catch (error) {
    // Fallback: If migrations folder doesn't exist, try relative path
    try {
      await migrate(testDb.db, { migrationsFolder: '../drizzle' });
    } catch {
      console.warn('Failed to run migrations:', error);
      // Silently fail for now to maintain backward compatibility
    }
  }
}

/**
 * Create an in-memory test database
 */
export function createTestDatabase(dbPath?: string): TestDatabase {
  const path = dbPath || ':memory:';
  const sqlite = new Database(path);
  const db = drizzle(sqlite, { schema });

  const cleanup = async () => {
    // Clear all tables
    const tableNames = [
      'homes',
      'rooms',
      'users',
      'devices',
      'entities',
      'entityState',
      'telemetry',
      'credentials',
      'entityStateHistories',
      'entityStates',
      'events',
    ];

    for (const tableName of tableNames) {
      try {
        await sqlite.run(`DELETE FROM ${tableName}`);
      } catch {
        // Table might not exist or already empty
      }
    }
  };

  return {
    cleanup,
    db,
    dbPath: path,
    sqlite,
  };
}

/**
 * Create test database with random temp file path
 */
export function createTempTestDatabase(): TestDatabase {
  const randomId = Math.random().toString(36).substring(7);
  const dbPath = `/tmp/hub-v2-test-${randomId}.db`;
  return createTestDatabase(dbPath);
}

/**
 * Set up test environment variables
 */
export function setupTestEnv(hubId = 'test-hub', port = 3201) {
  process.env.DB_PATH = ':memory:';
  process.env.HUB_ID = hubId;
  process.env.NODE_ENV = 'test';
  process.env.PORT = port.toString();

  // Suppress logger output in tests
  process.env.DEBUG = '';
  process.env.LOG_LEVEL = 'error';
}

/**
 * Clean up test environment
 */
export function cleanupTestEnv() {
  delete process.env.DB_PATH;
  delete process.env.HUB_ID;
  delete process.env.NODE_ENV;
  delete process.env.PORT;
  delete process.env.DEBUG;
  delete process.env.LOG_LEVEL;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

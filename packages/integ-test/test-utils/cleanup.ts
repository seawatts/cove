import type * as schema from '@cove/db/schema';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function cleanupTestData(
  db: PostgresJsDatabase<typeof schema>,
): Promise<void> {
  // Use TRUNCATE CASCADE for thorough cleanup
  try {
    await db.execute(
      sql`TRUNCATE TABLE "automationTrace", "automationVersion", "automation", "sceneVersion", "scene", "mode", "event", "eventPayload", "eventType", "entityStateHistory", "entityState", "entity", "device", "room", "floor", "home", "users" RESTART IDENTITY CASCADE`,
    );
  } catch (error) {
    console.error('Failed to cleanup test data:', error);
    throw error;
  }
}

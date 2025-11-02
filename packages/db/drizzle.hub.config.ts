/**
 * Drizzle configuration for Hub SQLite database
 *
 * This config is separate from the main drizzle.config.ts (PostgreSQL).
 * The hub uses a local SQLite database for device management and telemetry.
 *
 * Usage:
 *   bun hub:gen-migration  - Generate new migrations
 *   bun hub:migrate        - Apply migrations
 *   bun hub:studio         - Open Drizzle Studio
 */
import type { Config } from 'drizzle-kit';

export default {
  dbCredentials: { url: 'hub.db' },
  dialect: 'sqlite',
  out: './drizzle/hub',
  schema: './src/hub/schema.ts',
} satisfies Config;

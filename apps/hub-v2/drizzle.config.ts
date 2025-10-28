import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dbCredentials: {
    url: process.env.DB_PATH || 'hub.db',
  },
  dialect: 'sqlite',
  out: './drizzle',
  schema: './src/db/schema.ts',
});

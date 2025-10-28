# Database Migration with Bun SQLite and Drizzle

This project uses **Bun's native SQLite** (`bun:sqlite`) with **Drizzle ORM** for database management.

## Setup

### 1. Large Configuration
Created `drizzle.config.ts` to configure Drizzle Kit:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || 'hub.db',
  },
});
```

### 2. Database Client
The `DatabaseWrapper` class uses Bun's native SQLite with Drizzle's migrator:

```typescript
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

export class DatabaseWrapper {
  private sqlite: Database;
  private client: DatabaseClient;

  constructor(dbPath?: string) {
    // Use Bun's native SQLite
    this.sqlite = new Database(dbPath || 'hub.db');
    // Create Drizzle client
    this.client = drizzle(this.sqlite, { schema });
  }

  async initialize(migrationsFolder = './drizzle'): Promise<void> {
    // Run migrations using Drizzle migrator
    await migrate(this.client, { migrationsFolder });
  }
}
```

## Usage

### Generate Migrations
When you update the schema in `src/db/schema.ts`:

```bash
bunx drizzle-kit generate
```

This creates migration files in the `drizzle/` directory.

### Run Migrations
For production or persistent databases, run migrations:

```bash
bunx drizzle-kit migrate
```

### Push Schema (Development)
For quick prototyping without migration files:

```bash
bunx drizzle-kit push
```

**Note:** `drizzle-kit push` requires `better-sqlite3` or `@libsql/client` to be installed for SQLite connections.

### Database Studio
View and edit your database:

```bash
bunx drizzle-kit studio
```

## Test Databases

For in-memory test databases, we execute the migration SQL directly since `drizzle-kit` doesn't connect to Bun's SQLite. The test setup in `src/__tests__/setup.ts` loads and executes the migration SQL for fast test execution.

## References

- [Bun Docs: Using Drizzle ORM](https://bun.com/docs/guides/ecosystem/drizzle)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

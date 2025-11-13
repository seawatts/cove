# Hub Database Module

This module provides a SQLite database for the home automation hub using Drizzle ORM with Bun's native SQLite driver.

## Architecture Note

The hub database contains **device-centric data only**. User accounts, preferences, and authentication are managed in the cloud Postgres database (see `@cove/db/schema`), not in the hub. This allows:
- Multiple cloud users to access the same hub
- Hub to operate independently without user identity concerns
- User preferences to remain UI-only without affecting hub behavior

## Import Structure

The hub database module is split into two main exports to prevent bundling server-only code (like migrations and Node.js APIs) into client-side bundles:

### 🌐 Client-Safe Imports: `@cove/db/hub`

Use this for code that runs in **both client and server environments**:

```typescript
// ✅ Client Components, Server Components, API Routes, Server Actions
import type {
  EntityWithStateAndCapabilities,
  Device,
  Entity,
  Room,
  Home,
  // ... all other types
} from '@cove/db/hub';

import {
  // Utility functions
  entityToSensorMetadata,
  isUserFacingSensor,
  hasCapability,
  parseCapabilities,
  transformEntityForWeb,

  // Zod schemas
  entitySchema,
  deviceSchema,
  homeSchema,

  // Schema tables (for queries/types)
  entities,
  devices,
  homes,
  rooms,
  entityState,
  telemetry,
} from '@cove/db/hub';
```

**What's included:**
- ✅ All TypeScript types and interfaces
- ✅ Utility functions (transformers)
- ✅ Zod validation schemas
- ✅ Drizzle schema tables (for type inference)
- ❌ NO database client/wrapper
- ❌ NO migrations or Node.js APIs

### 🖥️ Server-Only Imports: `@cove/db/hub/server`

Use this **ONLY in server-side code** (API routes, server actions, hub daemon, etc.):

```typescript
// ✅ Server Components, API Routes, Server Actions, Hub Daemon
// ❌ NEVER in Client Components ('use client')
import type { HubDatabaseClient } from '@cove/db/hub/server';
import { HubDatabaseWrapper } from '@cove/db/hub/server';

// Initialize database
const dbWrapper = new HubDatabaseWrapper('./data/hub.db');
await dbWrapper.initialize(); // Runs migrations
const db = dbWrapper.getClient();

// Use the client
const devices = await db.select().from(schema.devices);
```

**What's included:**
- ✅ `HubDatabaseClient` type
- ✅ `HubDatabaseWrapper` class
- ⚠️ Contains Node.js/Bun-specific APIs (cannot be bundled for browser)

## Common Usage Patterns

### Client Component

```typescript
'use client';

import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
import { entityToSensorMetadata, isUserFacingSensor } from '@cove/db/hub';

export function DeviceComponent({ entities }: { entities: EntityWithStateAndCapabilities[] }) {
  const sensors = entities
    .filter(isUserFacingSensor)
    .map(entityToSensorMetadata);

  return <div>{/* render sensors */}</div>;
}
```

### Server Component / API Route

```typescript
// app/api/devices/route.ts
import type { HubDatabaseClient } from '@cove/db/hub/server';
import { devices, entities } from '@cove/db/hub';
import { getHubDatabase } from '@/lib/db'; // Your DB instance getter

export async function GET() {
  const db = getHubDatabase();

  const deviceList = await db
    .select()
    .from(devices)
    .leftJoin(entities, eq(entities.deviceId, devices.id));

  return Response.json(deviceList);
}
```

### Hub Daemon / Background Service

```typescript
import type { HubDatabaseClient } from '@cove/db/hub/server';
import { HubDatabaseWrapper } from '@cove/db/hub/server';
import { devices } from '@cove/db/hub';

export class HubDaemon {
  private db: HubDatabaseClient;

  async initialize() {
    const dbWrapper = new HubDatabaseWrapper('./data/hub.db');
    await dbWrapper.initialize(); // Runs migrations
    this.db = dbWrapper.getClient();
  }

  async getDevices() {
    return await this.db.select().from(devices);
  }
}
```

## Why This Split?

**Problem:** Next.js and other modern frameworks bundle code for both client and server. If client components import modules that depend on Node.js APIs (like `node:fs`, `bun:sqlite`), the build fails:

```
Error: the chunking context does not support external modules (request: node:fs)
```

**Solution:** Separate exports:
1. `@cove/db/hub` - Pure TypeScript/JavaScript code safe for any environment
2. `@cove/db/hub/server` - Server-only code with Node.js/Bun dependencies

This follows the same pattern as popular libraries like:
- `next/navigation` (client) vs `next/headers` (server)
- `@supabase/supabase-js` (client) vs `@supabase/ssr` (server)

## Migration Guide

If you're getting build errors after this change, update your imports:

### Before (❌ Old way)
```typescript
import type { HubDatabaseClient } from '@cove/db/hub';
import { HubDatabaseWrapper } from '@cove/db/hub';
```

### After (✅ New way)
```typescript
// In server-side code only
import type { HubDatabaseClient } from '@cove/db/hub/server';
import { HubDatabaseWrapper } from '@cove/db/hub/server';

// Client-safe code stays the same
import type { Entity, Device } from '@cove/db/hub';
import { entityToSensorMetadata } from '@cove/db/hub';
```

## Package.json Exports

The module exports are configured in `packages/db/package.json`:

```json
{
  "exports": {
    "./hub": "./src/hub/index.ts",        // Client-safe exports
    "./hub/server": "./src/hub/server.ts" // Server-only exports
  }
}
```

## Files

- `index.ts` - Client-safe exports (types, utilities, schemas)
- `server.ts` - Server-only exports (database client, wrapper)
- `client.ts` - Database client implementation (imported by server.ts)
- `schema.ts` - Drizzle schema tables
- `schemas.ts` - Zod validation schemas
- `transformers.ts` - Utility functions for data transformation
- `types.ts` - TypeScript type definitions

## Testing

Test files can import from either export depending on their needs:

```typescript
// Test setup (server-side)
import type { HubDatabaseClient } from '@cove/db/hub/server';
import * as schema from '@cove/db/hub';

// Test assertions (can use client-safe utilities)
import { entityToSensorMetadata } from '@cove/db/hub';
```

## Related Documentation

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Bun SQLite Guide](https://bun.sh/docs/api/sqlite)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Server Components vs Client Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)


# Cloud Sync Service - tRPC Client Integration

## Summary

Replaced raw `fetch()` calls with typed tRPC client for type-safe communication with the cloud API.

## Changes Made

### 1. Added Dependency
**File**: `packages/hub-core/package.json`
- Added `"@cove/api": "workspace:*"` to dependencies

### 2. Updated CloudSyncService
**File**: `packages/hub-core/src/core/cloud-sync.ts`

#### Added Imports
```typescript
import { createClient, type ApiClient } from '@cove/api/client';
```

#### Added API Client Instance
```typescript
private apiClient: ApiClient;
```

#### Initialized Client in Constructor
```typescript
// Initialize tRPC client for cloud API
this.apiClient = createClient({
  baseUrl: config.cloudApiUrl,
  sourceHeader: 'hub-sync',
});
```

#### Replaced Fetch Calls

**Before (registerHub)**:
```typescript
const response = await fetch(
  `${this.config.cloudApiUrl}/api/trpc/hubRegistry.register`,
  {
    body: JSON.stringify({ ... }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  },
);
```

**After**:
```typescript
const result = await this.apiClient.hubRegistry.register.mutate({
  cloudUrl: undefined,
  hubId: this.config.hubId,
  localUrl: this.config.localUrl,
  name: 'Home Hub',
  ownerId: this.config.ownerId,
  version: '2.0.0',
});
```

Same pattern applied to:
- `sendHeartbeat()` - Uses `hubRegistry.heartbeat.mutate()`
- `markOffline()` - Uses `hubRegistry.offline.mutate()`

## Benefits

### 1. Type Safety ✅
- Full TypeScript inference for request/response
- Compile-time validation of parameters
- No manual JSON serialization

### 2. Better Error Handling ✅
- Structured error responses
- Automatic error parsing
- Type-safe error handling

### 3. Code Quality ✅
- Less boilerplate code
- No manual URL construction
- No manual header management
- Automatic request/response transformation with SuperJSON

### 4. Maintainability ✅
- Single source of truth for API contracts
- Refactoring is type-safe
- IDE autocomplete for all API methods

## Example Usage

```typescript
// Old way - manual fetch
const response = await fetch(`${url}/api/trpc/hubRegistry.register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hubId: 'hub_123', ... })
});
const data = await response.json();

// New way - typed tRPC client
const result = await this.apiClient.hubRegistry.register.mutate({
  hubId: 'hub_123',
  // TypeScript will validate all fields!
});
// result is fully typed!
```

## Future Enhancements

When implementing the actual sync endpoints (currently stubbed in `syncItem()`), use the same pattern:

```typescript
// For device sync
await this.apiClient.cloudDevices.sync.mutate({
  hubId: this.config.hubId,
  devices: [...],
});

// For entity state sync
await this.apiClient.cloudEntities.syncState.mutate({
  hubId: this.config.hubId,
  states: [...],
});
```

## Testing

To verify the integration works:

1. **Type checking**: `bun run typecheck` (no tRPC-related errors)
2. **Unit tests**: Mock the `apiClient` in tests
3. **Integration tests**: Test against real cloud API

Example test:
```typescript
import { describe, expect, it, mock } from 'bun:test';

describe('CloudSyncService', () => {
  it('should register hub with typed client', async () => {
    const mockClient = {
      hubRegistry: {
        register: {
          mutate: mock(() => Promise.resolve({ id: 'hub_123' })),
        },
      },
    };

    const service = new CloudSyncService(config, deps);
    service['apiClient'] = mockClient as any;

    await service['registerHub']();

    expect(mockClient.hubRegistry.register.mutate).toHaveBeenCalledWith({
      hubId: expect.any(String),
      localUrl: expect.any(String),
      // ...
    });
  });
});
```


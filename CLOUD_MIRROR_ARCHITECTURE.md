# Cloud Mirror Architecture

This document describes the cloud mirroring architecture that enables remote access and graceful degradation when the hub is unreachable.

## Overview

The Cove system uses a **hybrid architecture** where:
- **Hub (SQLite)**: Source of truth for device data, runs locally
- **Cloud (Postgres)**: Mirrors hub data for remote access
- **Web App**: Intelligently routes to hub or cloud based on availability

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ CLOUD (Postgres)                                        │
│  • Users (Clerk auth)                                   │
│  • Hubs Registry (hub metadata, URLs)                   │
│  • Devices/Entities (mirrored from hubs)                │
│  • EntityStates (last known state)                      │
│  • EntityStateHistories (recent telemetry, 7 days)      │
│  • Rooms (mirrored topology)                            │
└─────────────────────────────────────────────────────────┘
                         ↕ Sync (HTTP + Heartbeat)
┌─────────────────────────────────────────────────────────┐
│ HUB (SQLite) - Source of Truth                          │
│  • Devices/Entities (real-time state)                   │
│  • Telemetry (full history)                             │
│  • AlertConfigs/History                                 │
│  • Credentials (local only, never synced)               │
│  • Cloud Sync Service (pushes changes)                  │
└─────────────────────────────────────────────────────────┘
        ↕ Local/Remote API (tRPC)          ↕ CloudFlare Tunnel
┌──────────────────────┐          ┌──────────────────────────┐
│ LOCAL NETWORK        │          │ REMOTE (via Tunnel)      │
│ http://192.168.x.x   │          │ https://hub.domain.com   │
└──────────────────────┘          └──────────────────────────┘
                    ↘                    ↙
                     ↘                  ↙
                      ↘                ↙
                ┌──────────────────────────┐
                │ WEB APP                  │
                │  • Connection Manager    │
                │  • Smart Routing         │
                │  • Status Badge          │
                └──────────────────────────┘
```

## Connection Modes

### 1. Local Mode (Best) ⚡

**When**: Web app and hub on same network
**How**: Direct HTTP connection to hub
**URL**: `http://192.168.1.100:3200`

**Benefits**:
- Lowest latency (<50ms typical)
- Real-time control
- No internet required (once authenticated)

**User Experience**:
- Green status badge
- Instant device responses
- Full control capability

### 2. Remote Mode (Good) 🌐

**When**: Away from home, hub has CloudFlare Tunnel
**How**: HTTPS through CloudFlare Tunnel
**URL**: `https://hub.yourdomain.com`

**Benefits**:
- Secure remote access
- Real-time control
- No port forwarding

**User Experience**:
- Yellow status badge
- Slightly higher latency (50-200ms)
- Full control capability

### 3. Cloud Mirror Mode (Degraded) 💾

**When**: Hub unreachable (offline or no tunnel)
**How**: Query cloud Postgres mirror
**URL**: Cloud API (`api.cove.app`)

**Benefits**:
- View last known state
- Works when hub offline
- Historical data access

**Limitations**:
- **Read-only** (no device control)
- Potentially stale data (depends on last sync)
- Limited telemetry (only recent data)

**User Experience**:
- Gray status badge
- "Viewing last synced state" warning
- Control buttons disabled
- Shows "Last synced" timestamp

### 4. Offline Mode (No Access) ❌

**When**: Hub offline and no cloud mirror data
**How**: N/A

**User Experience**:
- Red status badge
- "Hub offline" message
- No device data available

## Data Flow

### Hub → Cloud Sync

```typescript
// Hub Startup
1. Hub starts CloudSyncService
2. Registers with cloud via hubRegistry.register
3. Sends initial heartbeat
4. Subscribes to EventBus for changes

// Ongoing Sync
Every 30 seconds:
  - Send heartbeat (update online status)
  - Process sync queue (batch changes)

On Device/Entity Change:
  - EventBus emits event
  - CloudSyncService queues for sync
  - Next sync interval: push to cloud
```

### Web App Smart Routing

```typescript
// On Page Load
1. Check localStorage for cached hub info
2. Fetch user's hubs from cloud (hubRegistry.list)
3. For each hub:
   - Try local URL (fetch /health)
   - If fails, try remote URL
   - If both fail, set mode to 'cloud'

// On API Call
If mode === 'local' || mode === 'remote':
  → Call hub API directly
Else if mode === 'cloud':
  → Call cloud mirror API
Else:
  → Show offline error

// Periodic Recheck
Every 30 seconds:
  - Recheck hub connectivity
  - Update connection mode if changed
  - Show toast if mode changes
```

## Data Sync Strategy

### What Gets Synced

| Data Type | Sync Frequency | Retention |
|-----------|----------------|-----------|
| Devices | On change | Forever |
| Entities | On change | Forever |
| Entity State | Throttled (1/min) | Latest only |
| Telemetry | Sampled (5 min avg) | 7 days |
| Alerts | On trigger | 30 days |
| Credentials | **NEVER** | Local only |

### Sync Implementation

```typescript
// CloudSyncService (in hub-core)
class CloudSyncService {
  // Event Handlers
  onDevicePaired(device) {
    queueSync('device', device);
  }

  onEntityStateChange(state) {
    // Throttle: max 1 update per minute per entity
    if (canSync(state.entityId)) {
      queueSync('state', state);
    }
  }

  // Batch Processing
  async processSyncQueue() {
    const batch = queue.splice(0, 50);

    for (const item of batch) {
      await syncToCloud(item);
    }
  }

  // Retry Logic
  async syncToCloud(item) {
    try {
      await fetch('/api/sync', { body: item });
    } catch (err) {
      if (item.retryCount < MAX_RETRIES) {
        queue.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }
  }
}
```

## Database Schema Changes

### New Tables

#### `hubs` (Cloud Postgres)

```sql
CREATE TABLE hubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  local_url TEXT NOT NULL,
  cloud_url TEXT,
  online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP,
  version TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX hubs_owner_id_idx ON hubs(owner_id);
CREATE INDEX hubs_online_idx ON hubs(online);
CREATE INDEX hubs_last_seen_idx ON hubs(last_seen);
```

### Modified Tables

#### Added `hubId` foreign key to:
- `devices`
- `entities`
- `rooms`

This enables:
- Multi-hub support (one user, multiple hubs)
- Proper data segregation
- Efficient queries per hub

## API Endpoints

### Hub Registry API (Cloud)

```typescript
// packages/api/src/router/hub-registry.ts
hubRegistry.register      // Hub registers on startup
hubRegistry.heartbeat     // Hub sends periodic heartbeat
hubRegistry.offline       // Hub marks itself offline
hubRegistry.list          // Web app gets user's hubs
hubRegistry.get           // Web app gets specific hub
hubRegistry.update        // User updates hub settings
hubRegistry.delete        // User removes hub
```

### Cloud Mirror API (Cloud)

```typescript
// packages/api/src/router/cloud-devices.ts
cloudDevices.get          // Mirrors: hubApi.device.get
cloudDevices.getEntities  // Mirrors: hubApi.device.getEntities
cloudDevices.list         // Mirrors: hubApi.device.list

// packages/api/src/router/cloud-entities.ts
cloudEntities.get         // Mirrors: hubApi.entity.get
cloudEntities.getState    // Mirrors: hubApi.entity.getState
cloudEntities.list        // Mirrors: hubApi.entity.list

// packages/api/src/router/cloud-telemetry.ts
cloudTelemetry.get        // Mirrors: hubApi.telemetry.get
cloudTelemetry.getAggregated  // Mirrors: hubApi.telemetry.getAggregated
```

## Security Considerations

### Hub Authentication

Hubs use owner_id for registration:
```typescript
hubRegistry.register({
  ownerId: 'user_xxx',  // From environment or config
  hubId: 'hub_xxx',
  localUrl: 'http://192.168.1.100:3200'
})
```

**TODO**: Add API key authentication for hub → cloud communication

### Web App Authentication

Web app uses Clerk authentication:
- User must be logged in
- User can only access their own hubs
- Cloud APIs verify hub ownership

### CloudFlare Tunnel

Optional: Add CloudFlare Access for additional security:
- Require email verification
- Support Google/GitHub SSO
- IP whitelisting
- Geographic restrictions

## Multi-Hub Support

Users can have multiple hubs:
- Home hub
- Vacation home hub
- Parents' house hub

Each hub:
- Has its own SQLite database
- Syncs independently to cloud
- Can be accessed via local or remote URL
- Appears in hub selector in web app

## Offline Behavior

### Hub Offline
1. Last sync > 2 minutes ago
2. Health check fails
3. Cloud marks hub as offline
4. Web app shows cloud mirror mode
5. Control disabled, view only

### Hub Comes Back Online
1. Hub sends heartbeat
2. Cloud marks hub as online
3. Hub syncs any queued changes
4. Web app detects on next check
5. Switches back to direct connection
6. Toast notification: "Hub reconnected"

### Internet Outage (Local Network Up)
1. Hub continues running locally
2. Sync queue grows
3. Web app (if on local network) still works via local connection
4. When internet returns, hub syncs queued changes

## Performance Considerations

### Hub Performance
- Sync runs in background, doesn't block main loop
- Queue prevents memory growth (max 1000 items)
- Exponential backoff on failures
- Telemetry throttling reduces bandwidth

### Cloud Performance
- Indexes on hubId for fast queries
- Recent telemetry only (7 days)
- Efficient batch inserts
- Proper connection pooling

### Web App Performance
- Connection status cached (10 second TTL)
- Hub check timeout: 5 seconds
- Automatic mode switching
- Optimistic UI updates

## Future Enhancements

### Phase 2
- [ ] Implement actual sync endpoints (currently stubbed)
- [ ] Add telemetry aggregation in sync
- [ ] Add conflict resolution for simultaneous changes
- [ ] Compress sync payloads

### Phase 3
- [ ] WebSocket for real-time sync (replace HTTP polling)
- [ ] Delta sync (only changed fields)
- [ ] Sync priority queue (critical changes first)
- [ ] Sync analytics dashboard

### Phase 4
- [ ] Edge caching for cloud mirror
- [ ] Multi-region cloud deployment
- [ ] Hub federation (hub-to-hub communication)
- [ ] Offline-first progressive web app

## Related Documentation

- [CloudFlare Tunnel Setup](./apps/hub/CLOUDFLARE_TUNNEL.md)
- [Hub Core README](./packages/hub-core/README.md)
- [API Documentation](./packages/api/README.md)
- [Architecture Overview](./ARCHITECTURE.md)

## Troubleshooting

### Hub not syncing
1. Check `HUB_CLOUD_SYNC_ENABLED` is true
2. Check `HUB_OWNER_ID` is set
3. Check hub logs for sync errors
4. Verify cloud API is reachable

### Web app stuck in cloud mode
1. Check hub is actually online
2. Try manual connection check
3. Clear browser cache/localStorage
4. Check browser console for errors

### Stale data in cloud mirror
1. Check hub's last heartbeat timestamp
2. Verify sync service is running
3. Check sync queue size
4. Review hub logs for sync failures



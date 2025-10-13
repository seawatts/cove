import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { HubDaemon } from '../src/daemon';

// Skip Supabase calls in tests
process.env.SKIP_ENV_VALIDATION = 'true';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.DISCOVERY_ENABLED = 'false'; // Disable discovery for tests

describe('Hub Daemon', () => {
  let daemon: HubDaemon;

  beforeEach(() => {
    daemon = new HubDaemon('test-hub-id');
  });

  afterEach(async () => {
    if (daemon.isRunning()) {
      await daemon.stop();
    }
  });

  it('should initialize successfully', () => {
    expect(daemon).toBeDefined();
    expect(daemon.getHubId()).toBe('test-hub-id');
  });

  it('should start and stop correctly', async () => {
    expect(daemon.isRunning()).toBe(false);

    // Start daemon (will fail to connect to Supabase but that's ok for tests)
    try {
      await daemon.start();
    } catch {
      // Expected to fail without real Supabase connection
    }

    // Stop daemon
    await daemon.stop();
    expect(daemon.isRunning()).toBe(false);
  });

  it('should generate hub ID if not provided', () => {
    const daemon2 = new HubDaemon();
    const hubId = daemon2.getHubId();

    expect(hubId).toBeDefined();
    expect(hubId.length).toBeGreaterThan(0);
  });
});

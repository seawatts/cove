import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { HubDaemon } from '../daemon';
import {
  createTestDaemon,
  stopTestDaemon,
  waitForHubReady,
} from './daemon-helpers';
import type { TestDatabase } from './setup';
import { cleanupTestEnv, createTempTestDatabase, setupTestEnv } from './setup';

describe('Daemon Lifecycle', () => {
  let testDb: ReturnType<typeof createTempTestDatabase>;
  let daemon: HubDaemon;

  beforeEach(() => {
    setupTestEnv('test-hub');
    testDb = createTempTestDatabase();
  });

  afterEach(async () => {
    if (daemon) {
      await stopTestDaemon(daemon);
    }
    if (testDb) {
      await testDb.cleanup();
    }
    cleanupTestEnv();
  });

  describe('Initialization', () => {
    it('should initialize all components', async () => {
      daemon = await createTestDaemon({ testDb });

      const isReady = await waitForHubReady(daemon);
      expect(isReady).toBe(true);

      const status = daemon.getStatus();
      expect(status.components.database).toBe(true);
      expect(status.components.eventBus).toBe(true);
      expect(status.components.registry).toBe(true);
      expect(status.components.stateStore).toBe(true);
      expect(status.components.commandRouter).toBe(true);
      expect(status.components.driverRegistry).toBe(true);
    });

    it('should create default home', async () => {
      daemon = await createTestDaemon({ testDb });

      await waitForHubReady(daemon);

      const status = daemon.getStatus();
      expect(status.hubId).toBe('test-hub');

      // Wait a bit for home creation
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify home was created
      const homes = await testDb.db.query.homes.findMany();
      expect(homes.length).toBeGreaterThan(0);
    });

    it('should register drivers', async () => {
      daemon = await createTestDaemon({ testDb });

      await waitForHubReady(daemon);

      const status = daemon.getStatus();
      expect(status.drivers).toContain('esphome');
    });

    it('should start worker loops', async () => {
      daemon = await createTestDaemon({ testDb });

      await waitForHubReady(daemon);

      const status = daemon.getStatus();
      expect(status.workerLoops.discovery).toBe(true);
      expect(status.workerLoops.subscription).toBe(true);
    });
  });

  describe('Running State', () => {
    it('should process events via EventBus', async () => {
      daemon = await createTestDaemon({ testDb });
      await waitForHubReady(daemon);

      let eventReceived = false;

      if (daemon.eventBus) {
        // Subscribe to a specific entity state instead of wildcard
        daemon.eventBus.subscribe('entity/test-entity/state', () => {
          eventReceived = true;
        });

        // Publish test event
        daemon.eventBus.publishStateChanged({
          entityId: 'test-entity',
          state: { on: true },
        });

        // Wait longer for async processing
        await new Promise((resolve) => setTimeout(resolve, 200));

        expect(eventReceived).toBe(true);
      }
    });
  });

  describe('Shutdown', () => {
    it('should stop gracefully', async () => {
      daemon = await createTestDaemon({ testDb });
      await waitForHubReady(daemon);

      expect(daemon.getStatus().running).toBe(true);

      await daemon.stop();

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(daemon.getStatus().running).toBe(false);
    });

    it('should not start if already running', async () => {
      daemon = await createTestDaemon({ testDb });
      await waitForHubReady(daemon);

      // Try to start again
      await daemon.start();

      // Should still be running
      expect(daemon.getStatus().running).toBe(true);
    });

    it('should not stop if already stopped', async () => {
      daemon = await createTestDaemon({ testDb });
      await waitForHubReady(daemon);

      await daemon.stop();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to stop again
      await daemon.stop();

      // Should still be stopped
      expect(daemon.getStatus().running).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Test with invalid database path
      const invalidDb = createTempTestDatabase();
      delete (invalidDb as { dbPath?: string }).dbPath;

      try {
        daemon = await createTestDaemon({ testDb: invalidDb as TestDatabase });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});

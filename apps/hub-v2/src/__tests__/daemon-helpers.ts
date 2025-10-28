/**
 * Daemon-specific test helpers for Hub V2
 */

import { HubDaemon } from '../daemon';
import type { TestDatabase } from './setup';
import { initializeTables } from './setup';

export interface TestDaemonOptions {
  testDb: TestDatabase;
  hubId?: string;
}

/**
 * Create a test daemon with mock driver
 */
export async function createTestDaemon(
  options: TestDaemonOptions,
): Promise<HubDaemon> {
  const { testDb, hubId = 'test-hub' } = options;

  // Initialize database schema using generated migrations
  await initializeTables(testDb);

  // For tests, the daemon now uses auto-discovery which loads the MockESPHomeDriver
  // This approach tests the actual discovery mechanism
  // The MockESPHomeDriver should be placed in the drivers folder for tests if needed

  // Create daemon instance
  const daemon = new HubDaemon({
    dbPath: testDb.dbPath,
    hubId,
  });

  // Initialize the daemon (will use pre-registered mock driver)
  await daemon.initialize();

  // Start the daemon
  await daemon.start();

  return daemon;
}

/**
 * Wait for hub to be fully ready
 */
export async function waitForHubReady(
  daemon: HubDaemon,
  timeout = 10000,
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const status = daemon.getStatus();
    if (
      status.running &&
      status.components.database &&
      status.components.eventBus &&
      status.components.registry &&
      status.components.stateStore
    ) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Stop test daemon gracefully
 */
export async function stopTestDaemon(daemon: HubDaemon): Promise<void> {
  if (daemon) {
    await daemon.stop();
    // Give it time to clean up
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

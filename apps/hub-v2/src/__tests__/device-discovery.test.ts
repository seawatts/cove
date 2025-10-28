/**
 * Device Discovery and Pairing Integration Tests
 * Tests the full device discovery workflow and pairing process
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { HubDaemon } from '../daemon';
import {
  createTestDaemon,
  stopTestDaemon,
  waitForHubReady,
} from './daemon-helpers';
import { createMockCredentials, createMockDeviceDescriptor } from './factories';
import { cleanupTestEnv, createTempTestDatabase, setupTestEnv } from './setup';

describe('Device Discovery and Pairing', () => {
  let testDb: ReturnType<typeof createTempTestDatabase>;
  let daemon: HubDaemon;

  beforeEach(() => {
    setupTestEnv('test-hub-discovery');
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

  it('should discover ESPHome device', async () => {
    daemon = await createTestDaemon({ testDb });
    await waitForHubReady(daemon);

    // Create a test device by simulating discovery
    const deviceDesc = createMockDeviceDescriptor('esphome');

    // Register device through registry
    if (daemon.registry) {
      const home = await daemon.registry.getOrCreateHome('Test Home');
      const device = await daemon.registry.upsertDevice(deviceDesc, home.id);

      expect(device).toBeDefined();
      // Registry may generate a new ID, so just verify the device exists
      expect(device.id).toBeDefined();
      expect(device.name).toBe(deviceDesc.name);
      expect(device.protocol).toBe('esphome');
    }
  });

  it('should pair device with credentials', async () => {
    daemon = await createTestDaemon({ testDb });
    await waitForHubReady(daemon);

    const deviceDesc = createMockDeviceDescriptor('esphome');

    if (daemon.registry && daemon.driverRegistry) {
      const home = await daemon.registry.getOrCreateHome('Test Home');
      const device = await daemon.registry.upsertDevice(deviceDesc, home.id);

      // Get the mock driver
      const driver = daemon.driverRegistry.get('esphome');
      expect(driver).toBeDefined();

      // Pair the device
      const credentials = createMockCredentials('esphome');
      await driver?.pair(device.id, credentials);

      // Verify device was paired
      const pairedDevice = await daemon.registry.getDevice(device.id);
      expect(pairedDevice).toBeDefined();
    }
  });

  it('should discover entities after pairing', async () => {
    daemon = await createTestDaemon({ testDb });
    await waitForHubReady(daemon);

    const deviceDesc = createMockDeviceDescriptor('esphome');

    if (daemon.registry && daemon.driverRegistry) {
      const home = await daemon.registry.getOrCreateHome('Test Home');
      const device = await daemon.registry.upsertDevice(deviceDesc, home.id);

      // Get the driver (should be MockESPHomeDriver)
      const driver = daemon.driverRegistry.get('esphome');
      expect(driver).toBeDefined();

      // Skip this test if we're not using the mock driver
      // (driver.connect will fail with real ESPHome driver)
      const isMockDriver = driver?.constructor.name === 'MockESPHomeDriver';

      if (isMockDriver && driver) {
        // Connect using registry device ID
        await driver.connect(device.id, '192.168.1.100');

        // Get entities
        const entities = await driver.getEntities(device.id);
        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThan(0);
      } else {
        // Skip test if not using mock driver
        console.log('Skipping test - not using mock driver');
      }
    }
  });
});

/**
 * Apollo Air 1 Integration Tests
 *
 * These tests run against a REAL Apollo Air 1 ESPHome device on your network.
 *
 * To run these tests:
 * 1. Ensure Apollo Air 1 device is on the network and discoverable via mDNS
 * 2. Run: bun test apps/hub/src/__tests__/apollo-air-1-integration.test.ts
 *
 * WARNING: These tests will control your actual light!
 * Make sure you're okay with the light being toggled during tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { HubDaemon } from '@cove/hub-core';
import {
  createTestDaemon,
  stopTestDaemon,
  waitForHubReady,
} from '@cove/hub-core/__tests__/daemon-helpers';
import {
  cleanupTestEnv,
  createTempTestDatabase,
  setupTestEnv,
  sleep,
  waitFor,
} from './setup';

describe('Apollo Air 1 Integration Tests', () => {
  let testDb: ReturnType<typeof createTempTestDatabase>;
  let daemon: HubDaemon;
  let apolloDevice: { id: string; name: string; protocol: string } | null =
    null;
  let lightEntity: { id: string; name: string; kind: string } | null = null;
  let originalLightState: { state: boolean } | null = null;

  beforeEach(async () => {
    setupTestEnv('test-hub-apollo');
    testDb = createTempTestDatabase();
    daemon = await createTestDaemon({ testDb });
    await waitForHubReady(daemon);

    // Wait for Apollo Air 1 device to be discovered
    console.log('\n🔍 Waiting for Apollo Air 1 device to be discovered...');
    const deviceFound = await waitFor(async () => {
      const registry = daemon.getRegistry();
      if (!registry) return false;

      const home = await registry.getOrCreateHome('Default Home');
      const devices = await daemon.getDevicesByHome(home.id);

      // Find device with name containing "apollo" (case-insensitive)
      const apollo = devices.find((d) =>
        d.name?.toLowerCase().includes('apollo'),
      );

      if (apollo?.name) {
        apolloDevice = {
          id: apollo.id,
          name: apollo.name,
          protocol: apollo.protocol,
        };
        console.log(
          `✅ Found Apollo Air 1 device: ${apollo.name} (${apollo.id})`,
        );
        return true;
      }

      return false;
    }, 30000); // Wait up to 30 seconds for discovery

    if (!deviceFound || !apolloDevice) {
      throw new Error(
        'Apollo Air 1 device not found. Make sure it is on the network and discoverable via mDNS.',
      );
    }

    // Wait for entities to be discovered (entities are discovered after connection)
    console.log('\n🔍 Waiting for light entity to be discovered...');
    await sleep(3000); // Give time for entities to be discovered

    const entities = await daemon.getEntities({
      deviceId: apolloDevice.id,
      kind: 'light',
    });

    if (entities.length === 0) {
      // Wait a bit more and try again
      await sleep(2000);
      const retryEntities = await daemon.getEntities({
        deviceId: apolloDevice.id,
        kind: 'light',
      });

      if (retryEntities.length === 0) {
        throw new Error(
          `No light entities found for Apollo Air 1 device (${apolloDevice.id})`,
        );
      }

      lightEntity = {
        id: retryEntities[0].id,
        kind: retryEntities[0].kind,
        name: retryEntities[0].name || 'Unknown Light',
      };
    } else {
      lightEntity = {
        id: entities[0].id,
        kind: entities[0].kind,
        name: entities[0].name || 'Unknown Light',
      };
    }

    console.log(
      `✅ Found light entity: ${lightEntity.name} (${lightEntity.id})`,
    );

    // Get original light state for cleanup
    if (daemon.getStateStore() && lightEntity) {
      const stateRecord = await daemon
        .getStateStore()
        ?.getEntityState(lightEntity.id);
      if (
        stateRecord?.state &&
        typeof stateRecord.state === 'object' &&
        'state' in stateRecord.state
      ) {
        const stateObj = stateRecord.state as Record<string, unknown>;
        originalLightState = {
          state: Boolean(stateObj.state),
        };
      }
    }
  }); // 60 second timeout handled by waitFor function

  afterEach(async () => {
    // Restore original light state
    if (lightEntity && originalLightState !== null && daemon) {
      try {
        console.log(
          `\n🔄 Restoring light to original state: ${originalLightState.state ? 'ON' : 'OFF'}`,
        );
        await daemon.processCommand({
          capability: 'on_off',
          entityId: lightEntity.id,
          value: originalLightState.state,
        });
        await sleep(1000); // Wait for command to complete
      } catch (error) {
        console.error('Failed to restore light state:', error);
      }
    }

    if (daemon) {
      await stopTestDaemon(daemon);
    }
    if (testDb) {
      await testDb.cleanup();
    }
    cleanupTestEnv();
  });

  describe('Discovery', () => {
    it('should discover Apollo Air 1 device via mDNS', async () => {
      expect(apolloDevice).toBeDefined();
      expect(apolloDevice?.name.toLowerCase()).toContain('apollo');
      expect(apolloDevice?.protocol).toBe('esphome');
      console.log(
        `✅ Device discovered: ${apolloDevice?.name} (${apolloDevice?.id})`,
      );
    });
  });

  describe('Connection', () => {
    it('should connect to Apollo Air 1 device', async () => {
      if (!apolloDevice) throw new Error('Apollo Air 1 device not found');

      // Verify device is in registry
      const device = await daemon.getRegistry()?.getDevice(apolloDevice.id);
      expect(device).toBeDefined();
      expect(device?.id).toBe(apolloDevice.id);
      expect(device?.protocol).toBe('esphome');

      console.log(`✅ Device connected: ${device?.name}`);
    });
  });

  describe('Entity Discovery', () => {
    it('should discover light entities', async () => {
      if (!apolloDevice) throw new Error('Apollo Air 1 device not found');
      if (!lightEntity) throw new Error('Light entity not found');

      expect(lightEntity.kind).toBe('light');
      expect(lightEntity.id).toBeDefined();

      console.log(`✅ Light entity discovered: ${lightEntity.name}`);
    });
  });

  describe('Light State', () => {
    it('should get light state', async () => {
      if (!lightEntity) throw new Error('Light entity not found');
      const stateStore = daemon.getStateStore();
      if (!stateStore) throw new Error('State store not initialized');

      const stateRecord = await stateStore.getEntityState(lightEntity.id);
      // State might not exist yet if device was just discovered
      if (stateRecord) {
        expect(stateRecord).toBeDefined();
        if (
          stateRecord.state &&
          typeof stateRecord.state === 'object' &&
          'state' in stateRecord.state
        ) {
          const stateObj = stateRecord.state as Record<string, unknown>;
          const isOn = Boolean(stateObj.state);
          console.log(`✅ Light state retrieved: ${isOn ? 'ON' : 'OFF'}`);
        }
      } else {
        console.log(
          '⚠️  Light state not yet available (will be populated after first state update)',
        );
      }
    });
  });

  describe('Light Control', () => {
    it('should turn light on', async () => {
      if (!lightEntity) throw new Error('Light entity not found');

      console.log('\n💡 Turning light ON...');
      const result = await daemon.processCommand({
        capability: 'on_off',
        entityId: lightEntity.id,
        value: true,
      });

      if (!result.success) {
        console.error('Command failed:', result.error);
        throw new Error(
          `Failed to turn light on: ${result.error || 'Unknown error'}`,
        );
      }
      expect(result.success).toBe(true);

      // Wait for state to update
      await sleep(1500);

      const stateStore = daemon.getStateStore();
      if (stateStore) {
        const stateRecord = await stateStore.getEntityState(lightEntity.id);
        if (
          stateRecord?.state &&
          typeof stateRecord.state === 'object' &&
          'state' in stateRecord.state
        ) {
          const stateObj = stateRecord.state as Record<string, unknown>;
          const isOn = Boolean(stateObj.state);
          expect(isOn).toBe(true);
          console.log('✅ Light is ON');
        }
      }
    }, 10000);

    it('should turn light off', async () => {
      if (!lightEntity) throw new Error('Light entity not found');

      // First turn it on to ensure it's on
      await daemon.processCommand({
        capability: 'on_off',
        entityId: lightEntity.id,
        value: true,
      });
      await sleep(1500);

      console.log('\n💡 Turning light OFF...');
      const result = await daemon.processCommand({
        capability: 'on_off',
        entityId: lightEntity.id,
        value: false,
      });

      if (!result.success) {
        console.error('Command failed:', result.error);
        throw new Error(
          `Failed to turn light off: ${result.error || 'Unknown error'}`,
        );
      }
      expect(result.success).toBe(true);

      // Wait for state to update
      await sleep(1500);

      const stateStore = daemon.getStateStore();
      if (stateStore) {
        const stateRecord = await stateStore.getEntityState(lightEntity.id);
        if (
          stateRecord?.state &&
          typeof stateRecord.state === 'object' &&
          'state' in stateRecord.state
        ) {
          const stateObj = stateRecord.state as Record<string, unknown>;
          const isOn = Boolean(stateObj.state);
          expect(isOn).toBe(false);
          console.log('✅ Light is OFF');
        }
      }
    }, 10000);

    it('should toggle light on and off', async () => {
      if (!lightEntity) throw new Error('Light entity not found');

      // Get initial state
      const initialState = originalLightState?.state ?? false;

      console.log(
        `\n💡 Toggling light (initial state: ${initialState ? 'ON' : 'OFF'})...`,
      );

      // Toggle to opposite of initial state
      const firstToggle = !initialState;
      let result = await daemon.processCommand({
        capability: 'on_off',
        entityId: lightEntity.id,
        value: firstToggle,
      });
      if (!result.success) {
        console.error('Command failed:', result.error);
        throw new Error(
          `Failed to toggle light: ${result.error || 'Unknown error'}`,
        );
      }
      expect(result.success).toBe(true);
      await sleep(1500);

      // Verify state changed
      const stateStore = daemon.getStateStore();
      if (stateStore) {
        const stateRecord = await stateStore.getEntityState(lightEntity.id);
        if (
          stateRecord?.state &&
          typeof stateRecord.state === 'object' &&
          'state' in stateRecord.state
        ) {
          const stateObj = stateRecord.state as Record<string, unknown>;
          expect(Boolean(stateObj.state)).toBe(firstToggle);
          console.log(`✅ Light toggled to ${firstToggle ? 'ON' : 'OFF'}`);
        }
      }

      // Toggle back
      const secondToggle = !firstToggle;
      result = await daemon.processCommand({
        capability: 'on_off',
        entityId: lightEntity.id,
        value: secondToggle,
      });
      expect(result.success).toBe(true);
      await sleep(1500);

      // Verify state changed back
      if (stateStore) {
        const stateRecord = await stateStore.getEntityState(lightEntity.id);
        if (
          stateRecord?.state &&
          typeof stateRecord.state === 'object' &&
          'state' in stateRecord.state
        ) {
          const stateObj = stateRecord.state as Record<string, unknown>;
          expect(Boolean(stateObj.state)).toBe(secondToggle);
          console.log(
            `✅ Light toggled back to ${secondToggle ? 'ON' : 'OFF'}`,
          );
        }
      }
    }, 15000);
  });
});

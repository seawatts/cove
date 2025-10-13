/**
 * Hue Integration Tests
 *
 * These tests run against a REAL Hue bridge on your network.
 *
 * To run these tests:
 * 1. Set environment variables:
 *    - HUE_BRIDGE_IP=192.168.1.100 (your bridge IP)
 *    - HUE_USERNAME=existing-username (optional, will create one if not provided)
 * 2. Run: bun test tests/hue/integration.test.ts
 *
 * WARNING: These tests will control your actual lights!
 * Make sure you're okay with lights being toggled during tests.
 */

import '../setup';
import { describe, expect, it } from 'bun:test';
import { discoverBridgesHTTPS, HueClient } from '../../src/hue';

// Skip these tests unless explicitly enabled
const INTEGRATION_TESTS_ENABLED =
  process.env.RUN_HUE_INTEGRATION_TESTS === 'true';
const describeIf = INTEGRATION_TESTS_ENABLED ? describe : describe.skip;

describeIf('Hue Integration Tests (Real Bridge)', async () => {
  let client: HueClient;
  let bridgeIP: string;
  let username: string | undefined;
  let testLightId: string | undefined;

  // Setup function (will run once before all tests)
  const setup = async () => {
    // Get bridge IP from environment or discovery
    bridgeIP = process.env.HUE_BRIDGE_IP || '';

    if (!bridgeIP) {
      console.log('Attempting to discover bridge...');
      const bridges = await discoverBridgesHTTPS();
      if (bridges.length === 0) {
        throw new Error(
          'No bridge found. Set HUE_BRIDGE_IP environment variable.',
        );
      }
      bridgeIP = bridges[0]?.internalipaddress || '';
      console.log(`Found bridge at ${bridgeIP}`);
    }

    // Try to use existing username or create new one
    username = process.env.HUE_USERNAME;

    client = new HueClient({
      host: bridgeIP,
      useHttps: true,
      username,
    });

    // If no username, authenticate
    if (!username) {
      console.log('\n⚠️  PRESS THE LINK BUTTON ON YOUR HUE BRIDGE NOW!');
      console.log('Waiting 10 seconds...\n');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      try {
        username = await client.authenticate('cove-integration-test');
        console.log('\n✅ Authenticated! Save this username for future tests:');
        console.log(`   export HUE_USERNAME="${username}"\n`);
      } catch (error) {
        throw new Error(
          `Authentication failed. Did you press the link button? ${error}`,
        );
      }
    }

    // Connect
    await client.connect();

    // Get first available light for testing
    const lights = await client.getLights();
    const lightIds = Object.keys(lights);
    if (lightIds.length === 0) {
      throw new Error('No lights found on bridge');
    }
    testLightId = lightIds[0];
    console.log(`Using light "${lights[testLightId]?.name}" for tests\n`);
  };

  // Run setup before tests
  if (INTEGRATION_TESTS_ENABLED) {
    await setup();
  }

  describe('Discovery', () => {
    it('should discover bridge via HTTPS', async () => {
      const bridges = await discoverBridgesHTTPS();
      expect(bridges.length).toBeGreaterThan(0);

      const bridge = bridges.find((b) => b.internalipaddress === bridgeIP);
      expect(bridge).toBeDefined();
    });
  });

  describe('Bridge Info', () => {
    it('should get bridge configuration', async () => {
      const config = await client.getBridgeConfig();

      expect(config).toBeDefined();
      expect(config.name).toBeDefined();
      expect(config.swversion).toBeDefined();
      expect(config.bridgeid).toBeDefined();
      expect(config.modelid).toBeDefined();

      console.log(`Bridge: ${config.name} (${config.modelid})`);
      console.log(`Firmware: ${config.swversion}`);
    });

    it('should get all resources', async () => {
      const resources = await client.getAll();

      expect(resources).toBeDefined();
      expect(resources.lights).toBeDefined();
      expect(resources.groups).toBeDefined();
      expect(resources.config).toBeDefined();

      console.log(`Lights: ${Object.keys(resources.lights).length}`);
      console.log(`Groups: ${Object.keys(resources.groups).length}`);
      console.log(`Scenes: ${Object.keys(resources.scenes).length}`);
    });
  });

  describe('Light Control', () => {
    it('should get all lights', async () => {
      const lights = await client.getLights();

      expect(lights).toBeDefined();
      expect(Object.keys(lights).length).toBeGreaterThan(0);

      for (const [id, light] of Object.entries(lights)) {
        console.log(
          `  ${id}: ${light.name} (${light.type}) - ${light.state.on ? 'ON' : 'OFF'}`,
        );
      }
    });

    it('should get specific light', async () => {
      if (!testLightId) throw new Error('No test light available');

      const light = await client.getLight(testLightId);

      expect(light).toBeDefined();
      expect(light.name).toBeDefined();
      expect(light.state).toBeDefined();
    });

    it('should toggle light on and off', async () => {
      if (!testLightId) throw new Error('No test light available');

      // Get current state
      const beforeLight = await client.getLight(testLightId);
      const originalState = beforeLight.state.on;

      // Toggle off
      await client.toggleLight(testLightId, false);
      await new Promise((resolve) => setTimeout(resolve, 500));
      let light = await client.getLight(testLightId);
      expect(light.state.on).toBe(false);

      // Toggle on
      await client.toggleLight(testLightId, true);
      await new Promise((resolve) => setTimeout(resolve, 500));
      light = await client.getLight(testLightId);
      expect(light.state.on).toBe(true);

      // Restore original state
      await client.toggleLight(testLightId, originalState);
    }, 10000);

    it('should set brightness', async () => {
      if (!testLightId) throw new Error('No test light available');

      const originalLight = await client.getLight(testLightId);

      await client.setBrightness(testLightId, 100);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const light = await client.getLight(testLightId);
      expect(light.state.bri).toBe(100);

      // Restore
      if (originalLight.state.bri !== undefined) {
        await client.setBrightness(testLightId, originalLight.state.bri);
      }
    }, 10000);
  });

  describe('Groups', () => {
    it('should get all groups', async () => {
      const groups = await client.getGroups();

      expect(groups).toBeDefined();

      for (const [id, group] of Object.entries(groups)) {
        console.log(
          `  ${id}: ${group.name} (${group.type}) - ${group.lights.length} lights`,
        );
      }
    });
  });

  describe('Scenes', () => {
    it('should get all scenes', async () => {
      const scenes = await client.getScenes();

      expect(scenes).toBeDefined();

      const sceneList = Object.entries(scenes).slice(0, 5);
      for (const [id, scene] of sceneList) {
        console.log(`  ${id}: ${scene.name} (${scene.lights.length} lights)`);
      }
    });
  });
});

// Instructions for users
if (!INTEGRATION_TESTS_ENABLED) {
  console.log('\n📝 Integration tests are disabled by default.');
  console.log('\nTo enable them:');
  console.log('  1. Set environment variables:');
  console.log('     export HUE_BRIDGE_IP=192.168.1.100');
  console.log('     export HUE_USERNAME=your-api-key  # Optional');
  console.log('     export RUN_HUE_INTEGRATION_TESTS=true');
  console.log('\n  2. Run tests:');
  console.log('     bun test tests/hue/integration.test.ts\n');
}

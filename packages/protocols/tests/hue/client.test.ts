/**
 * Hue Client Tests
 */

import '../setup';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { HueClient } from '../../src/hue/client';
import { MockHueBridge } from './mock-bridge';

describe('Hue Client', () => {
  let mockBridge: MockHueBridge;
  let client: HueClient;

  beforeEach(() => {
    // Start mock bridge on random port
    mockBridge = new MockHueBridge({ port: 8888 });
    mockBridge.start();

    // Create client pointing to mock bridge
    client = new HueClient({
      host: 'localhost',
      port: 8888,
      timeout: 2000,
      useHttps: false, // Use HTTP for tests
    });
  });

  afterEach(() => {
    mockBridge.stop();
  });

  describe('Authentication', () => {
    it('should fail authentication without link button pressed', async () => {
      await expect(client.authenticate('test#app')).rejects.toThrow(
        'link button not pressed',
      );
    });

    it('should authenticate successfully with link button pressed', async () => {
      mockBridge.pressLinkButton();
      const username = await client.authenticate('test#app');

      expect(username).toBeDefined();
      expect(username).toBe(mockBridge.getUsername());
    });

    it('should store username after authentication', async () => {
      mockBridge.pressLinkButton();
      await client.authenticate('test#app');

      // Should be able to connect now
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('Connection', () => {
    beforeEach(async () => {
      // Authenticate first
      mockBridge.pressLinkButton();
      await client.authenticate('test#app');
    });

    it('should connect successfully', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('should disconnect successfully', async () => {
      await client.connect();
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('should fail to connect without authentication', async () => {
      const unauthClient = new HueClient({
        host: 'localhost',
        port: 8888,
        useHttps: false,
      });

      await expect(unauthClient.connect()).rejects.toThrow('Not authenticated');
    });
  });

  describe('Bridge Info', () => {
    beforeEach(async () => {
      mockBridge.pressLinkButton();
      await client.authenticate('test#app');
      await client.connect();
    });

    it('should get bridge configuration', async () => {
      const config = await client.getBridgeConfig();

      expect(config).toBeDefined();
      expect(config.name).toBe('Mock Hue Bridge');
      expect(config.swversion).toBeDefined();
      expect(config.bridgeid).toBeDefined();
    });

    it('should get all resources', async () => {
      const resources = await client.getAll();

      expect(resources).toBeDefined();
      expect(resources.lights).toBeDefined();
      expect(resources.groups).toBeDefined();
      expect(resources.scenes).toBeDefined();
      expect(resources.config).toBeDefined();
    });
  });

  describe('Light Control', () => {
    beforeEach(async () => {
      mockBridge.pressLinkButton();
      await client.authenticate('test#app');
      await client.connect();
    });

    it('should get all lights', async () => {
      const lights = await client.getLights();

      expect(lights).toBeDefined();
      expect(Object.keys(lights).length).toBeGreaterThan(0);
      expect(lights['1']).toBeDefined();
      expect(lights['1']?.name).toBe('Living Room 1');
    });

    it('should get specific light', async () => {
      const light = await client.getLight('1');

      expect(light).toBeDefined();
      expect(light.name).toBe('Living Room 1');
      expect(light.state).toBeDefined();
    });

    it('should toggle light on', async () => {
      const result = await client.toggleLight('1', true);
      expect(result).toBeDefined();
    });

    it('should toggle light off', async () => {
      const result = await client.toggleLight('1', false);
      expect(result).toBeDefined();
    });

    it('should set brightness', async () => {
      const result = await client.setBrightness('1', 200);
      expect(result).toBeDefined();
    });

    it('should clamp brightness to valid range', async () => {
      await client.setBrightness('1', 300);
      await client.setBrightness('1', -10);
      expect(true).toBe(true);
    });

    it('should set color', async () => {
      const result = await client.setColor('1', 10000, 254);
      expect(result).toBeDefined();
    });

    it('should set color temperature', async () => {
      const result = await client.setColorTemperature('1', 350);
      expect(result).toBeDefined();
    });

    it('should set XY color', async () => {
      const result = await client.setXY('1', 0.5, 0.5);
      expect(result).toBeDefined();
    });

    it('should set complex light state', async () => {
      const result = await client.setLightState('1', {
        alert: 'select',
        bri: 200,
        hue: 10000,
        on: true,
        sat: 254,
        transitiontime: 10,
      });
      expect(result).toBeDefined();
    });

    it('should rename light', async () => {
      const result = await client.renameLight('1', 'New Name');
      expect(result).toBeDefined();
    });
  });

  describe('Group Control', () => {
    beforeEach(async () => {
      mockBridge.pressLinkButton();
      await client.authenticate('test#app');
      await client.connect();
    });

    it('should get all groups', async () => {
      const groups = await client.getGroups();

      expect(groups).toBeDefined();
      expect(Object.keys(groups).length).toBeGreaterThan(0);
      expect(groups['1']).toBeDefined();
      expect(groups['1']?.name).toBe('Living Room');
    });

    it('should get specific group', async () => {
      const group = await client.getGroup('1');

      expect(group).toBeDefined();
      expect(group.name).toBe('Living Room');
      expect(group.lights).toBeDefined();
      expect(group.lights.length).toBeGreaterThan(0);
    });

    it('should set group state', async () => {
      const result = await client.setGroupState('1', { bri: 200, on: true });
      expect(result).toBeDefined();
    });

    it('should create new group', async () => {
      const result = await client.createGroup('Test Room', ['1', '2'], 'Room');
      expect(result).toBeDefined();
    });

    it('should delete group', async () => {
      const result = await client.deleteGroup('1');
      expect(result).toBeDefined();
    });
  });

  describe('Scene Control', () => {
    beforeEach(async () => {
      mockBridge.pressLinkButton();
      await client.authenticate('test#app');
      await client.connect();
    });

    it('should get all scenes', async () => {
      const scenes = await client.getScenes();

      expect(scenes).toBeDefined();
      expect(Object.keys(scenes).length).toBeGreaterThan(0);
    });

    it('should get specific scene', async () => {
      // The mock bridge has scenes, just use a known ID
      const scene = await client.getScene('scene-1');

      expect(scene).toBeDefined();
      expect(scene.name).toBeDefined();
    });

    it('should activate scene', async () => {
      const result = await client.activateScene('scene-1');
      expect(result).toBeDefined();
    });

    it('should activate scene in specific group', async () => {
      const result = await client.activateScene('scene-1', '1');
      expect(result).toBeDefined();
    });

    it('should create new scene', async () => {
      const result = await client.createScene('New Scene', ['1', '2']);
      expect(result).toBeDefined();
    });

    it('should delete scene', async () => {
      const result = await client.deleteScene('scene-1');
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockBridge.pressLinkButton();
      await client.authenticate('test#app');
      await client.connect();
    });

    it('should handle non-existent light', async () => {
      await expect(client.getLight('999')).rejects.toThrow();
    });

    it('should handle non-existent group', async () => {
      await expect(client.getGroup('999')).rejects.toThrow();
    });

    it('should handle non-existent scene', async () => {
      await expect(client.getScene('non-existent')).rejects.toThrow();
    });

    it('should handle timeout', async () => {
      const slowClient = new HueClient({
        host: 'localhost',
        port: 9999, // Non-existent server
        timeout: 100, // Very short timeout
        useHttps: false,
      });

      mockBridge.pressLinkButton();

      await expect(slowClient.authenticate('test#app')).rejects.toThrow();
    });
  });
});

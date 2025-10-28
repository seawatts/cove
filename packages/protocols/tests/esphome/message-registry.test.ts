/**
 * ESPHome Message Registry Tests
 * Tests for the comprehensive message registry and parsing functionality
 */

import { describe, expect, it } from 'bun:test';
import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import {
  ButtonCommandRequestSchema,
  HelloRequestSchema,
  LightCommandRequestSchema,
  LightStateResponseSchema,
  ListEntitiesLightResponseSchema,
  NumberCommandRequestSchema,
  SwitchCommandRequestSchema,
} from '../../src/esphome/protoc/api_pb';
import {
  getAllMessageIds,
  getIdBySchema,
  getMessageNameById,
  getRegistryEntry,
  getSchemaById,
  isValidMessageId,
  MESSAGE_REGISTRY,
} from '../../src/esphome/utils/message-registry';

describe('ESPHome Message Registry', () => {
  describe('Registry completeness', () => {
    it('should have all core connection messages', () => {
      expect(MESSAGE_REGISTRY.has(1)).toBe(true); // HelloRequest
      expect(MESSAGE_REGISTRY.has(2)).toBe(true); // HelloResponse
      expect(MESSAGE_REGISTRY.has(3)).toBe(true); // AuthenticationRequest
      expect(MESSAGE_REGISTRY.has(4)).toBe(true); // AuthenticationResponse
      expect(MESSAGE_REGISTRY.has(7)).toBe(true); // PingRequest
      expect(MESSAGE_REGISTRY.has(8)).toBe(true); // PingResponse
    });

    it('should have all entity discovery messages', () => {
      expect(MESSAGE_REGISTRY.has(11)).toBe(true); // ListEntitiesRequest
      expect(MESSAGE_REGISTRY.has(15)).toBe(true); // ListEntitiesLightResponse
      expect(MESSAGE_REGISTRY.has(17)).toBe(true); // ListEntitiesSwitchResponse
      expect(MESSAGE_REGISTRY.has(46)).toBe(true); // ListEntitiesNumberResponse
      expect(MESSAGE_REGISTRY.has(61)).toBe(true); // ListEntitiesButtonResponse
      expect(MESSAGE_REGISTRY.has(19)).toBe(true); // ListEntitiesDoneResponse
    });

    it('should have all state messages', () => {
      expect(MESSAGE_REGISTRY.has(20)).toBe(true); // SubscribeStatesRequest
      expect(MESSAGE_REGISTRY.has(24)).toBe(true); // LightStateResponse
      expect(MESSAGE_REGISTRY.has(26)).toBe(true); // SwitchStateResponse
      expect(MESSAGE_REGISTRY.has(48)).toBe(true); // NumberStateResponse
    });

    it('should have all command messages', () => {
      expect(MESSAGE_REGISTRY.has(32)).toBe(true); // LightCommandRequest
      expect(MESSAGE_REGISTRY.has(33)).toBe(true); // SwitchCommandRequest
      expect(MESSAGE_REGISTRY.has(47)).toBe(true); // NumberCommandRequest
      expect(MESSAGE_REGISTRY.has(62)).toBe(true); // ButtonCommandRequest
    });

    it('should have device info messages', () => {
      expect(MESSAGE_REGISTRY.has(9)).toBe(true); // DeviceInfoRequest
      expect(MESSAGE_REGISTRY.has(10)).toBe(true); // DeviceInfoResponse
    });
  });

  describe('Registry lookup functions', () => {
    it('should get schema by ID', () => {
      const helloSchema = getSchemaById(1);
      expect(helloSchema).toBe(HelloRequestSchema);

      const lightCommandSchema = getSchemaById(32);
      expect(lightCommandSchema).toBe(LightCommandRequestSchema);
    });

    it('should get ID by schema', () => {
      const helloId = getIdBySchema(HelloRequestSchema);
      expect(helloId).toBe(1);

      const lightCommandId = getIdBySchema(LightCommandRequestSchema);
      expect(lightCommandId).toBe(32);
    });

    it('should get message name by ID', () => {
      const helloName = getMessageNameById(1);
      expect(helloName).toBe('HelloRequest');

      const lightCommandName = getMessageNameById(32);
      expect(lightCommandName).toBe('LightCommandRequest');
    });

    it('should get registry entry by ID', () => {
      const helloEntry = getRegistryEntry(1);
      expect(helloEntry).toEqual({
        direction: 'request',
        id: 1,
        name: 'HelloRequest',
        schema: HelloRequestSchema,
      });
    });

    it('should validate message IDs', () => {
      expect(isValidMessageId(1)).toBe(true);
      expect(isValidMessageId(32)).toBe(true);
      expect(isValidMessageId(999)).toBe(false);
      expect(isValidMessageId(0)).toBe(false);
    });

    it('should get all message IDs', () => {
      const allIds = getAllMessageIds();
      expect(allIds).toContain(1);
      expect(allIds).toContain(32);
      expect(allIds.length).toBeGreaterThan(50); // Should have many messages
      expect(allIds).toEqual(allIds.sort((a, b) => a - b)); // Should be sorted
    });
  });

  describe('Bidirectional mapping', () => {
    it('should have consistent schema to ID mapping', () => {
      for (const [id, entry] of MESSAGE_REGISTRY) {
        const mappedId = getIdBySchema(entry.schema);
        expect(mappedId).toBe(id);
      }
    });

    it('should have consistent ID to schema mapping', () => {
      for (const [id, entry] of MESSAGE_REGISTRY) {
        const mappedSchema = getSchemaById(id);
        expect(mappedSchema).toBe(entry.schema);
      }
    });
  });

  describe('Message parsing integration', () => {
    it('should parse hello request message', () => {
      const helloRequest = create(HelloRequestSchema, {
        apiVersionMajor: 1,
        apiVersionMinor: 8,
        clientInfo: 'test-client',
      });

      const binary = toBinary(HelloRequestSchema, helloRequest);
      const parsed = fromBinary(HelloRequestSchema, binary);

      expect(parsed.clientInfo).toBe('test-client');
      expect(parsed.apiVersionMajor).toBe(1);
      expect(parsed.apiVersionMinor).toBe(8);
    });

    it('should parse light command message', () => {
      const lightCommand = create(LightCommandRequestSchema, {
        blue: 0.2,
        brightness: 0.8,
        green: 0.5,
        key: 123,
        red: 1.0,
        state: true,
      });

      const binary = toBinary(LightCommandRequestSchema, lightCommand);
      const parsed = fromBinary(LightCommandRequestSchema, binary);

      expect(parsed.key).toBe(123);
      expect(parsed.state).toBe(true);
      expect(parsed.brightness).toBeCloseTo(0.8, 5);
      expect(parsed.red).toBeCloseTo(1.0, 5);
      expect(parsed.green).toBeCloseTo(0.5, 5);
      expect(parsed.blue).toBeCloseTo(0.2, 5);
    });

    it('should parse switch command message', () => {
      const switchCommand = create(SwitchCommandRequestSchema, {
        key: 456,
        state: false,
      });

      const binary = toBinary(SwitchCommandRequestSchema, switchCommand);
      const parsed = fromBinary(SwitchCommandRequestSchema, binary);

      expect(parsed.key).toBe(456);
      expect(parsed.state).toBe(false);
    });

    it('should parse number command message', () => {
      const numberCommand = create(NumberCommandRequestSchema, {
        key: 789,
        state: 42.5,
      });

      const binary = toBinary(NumberCommandRequestSchema, numberCommand);
      const parsed = fromBinary(NumberCommandRequestSchema, binary);

      expect(parsed.key).toBe(789);
      expect(parsed.state).toBe(42.5);
    });

    it('should parse button command message', () => {
      const buttonCommand = create(ButtonCommandRequestSchema, {
        key: 101,
      });

      const binary = toBinary(ButtonCommandRequestSchema, buttonCommand);
      const parsed = fromBinary(ButtonCommandRequestSchema, binary);

      expect(parsed.key).toBe(101);
    });

    it('should parse light state response message', () => {
      const lightState = create(LightStateResponseSchema, {
        blue: 0.2,
        brightness: 0.8,
        coldWhite: 0.0,
        colorMode: 3, // RGB
        colorTemperature: 0.0,
        effect: '',
        green: 0.5,
        key: 123,
        red: 1.0,
        state: true,
        warmWhite: 0.0,
        white: 0.0,
      });

      const binary = toBinary(LightStateResponseSchema, lightState);
      const parsed = fromBinary(LightStateResponseSchema, binary);

      expect(parsed.key).toBe(123);
      expect(parsed.state).toBe(true);
      expect(parsed.brightness).toBeCloseTo(0.8, 5);
      expect(parsed.colorMode).toBe(3);
    });

    it('should parse list entities light response message', () => {
      const listEntitiesLight = create(ListEntitiesLightResponseSchema, {
        deviceId: 1,
        disabledByDefault: false,
        effects: ['rainbow', 'strobe'],
        entityCategory: 0,
        icon: 'mdi:lightbulb',
        key: 123,
        legacySupportsBrightness: true,
        legacySupportsColorTemperature: false,
        legacySupportsRgb: true,
        legacySupportsWhiteValue: false,
        maxMireds: 500,
        minMireds: 153,
        name: 'Test Light',
        objectId: 'test-light',
        supportedColorModes: [1, 2, 3], // Brightness, RGB, RGBW
        uniqueId: 'test-light-123',
      });

      const binary = toBinary(
        ListEntitiesLightResponseSchema,
        listEntitiesLight,
      );
      const parsed = fromBinary(ListEntitiesLightResponseSchema, binary);

      expect(parsed.objectId).toBe('test-light');
      expect(parsed.key).toBe(123);
      expect(parsed.name).toBe('Test Light');
      expect(parsed.supportedColorModes).toEqual([1, 2, 3]);
      expect(parsed.legacySupportsBrightness).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle unknown message IDs gracefully', () => {
      expect(getSchemaById(999)).toBeUndefined();
      expect(getMessageNameById(999)).toBeUndefined();
      expect(getRegistryEntry(999)).toBeUndefined();
      expect(isValidMessageId(999)).toBe(false);
    });

    it('should handle invalid schemas gracefully', () => {
      const invalidSchema = {} as any;
      expect(getIdBySchema(invalidSchema)).toBeUndefined();
    });
  });

  describe('Registry metadata', () => {
    it('should have correct message directions', () => {
      const helloRequest = getRegistryEntry(1);
      expect(helloRequest?.direction).toBe('request');

      const helloResponse = getRegistryEntry(2);
      expect(helloResponse?.direction).toBe('response');

      const lightCommand = getRegistryEntry(32);
      expect(lightCommand?.direction).toBe('request');

      const lightState = getRegistryEntry(24);
      expect(lightState?.direction).toBe('response');
    });

    it('should have consistent naming convention', () => {
      for (const [id, entry] of MESSAGE_REGISTRY) {
        if (entry.direction === 'request') {
          expect(entry.name).toMatch(/Request$/);
        } else if (entry.direction === 'response') {
          expect(entry.name).toMatch(/Response$/);
        }
      }
    });
  });
});

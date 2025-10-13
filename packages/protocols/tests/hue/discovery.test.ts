/**
 * Hue Discovery Tests
 */

import '../setup';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  discoverBridgesHTTPS,
  getBridgeURL,
  getMDNSServiceType,
  isValidBridge,
} from '../../src/hue/discovery';
import type { HueBridgeDiscovery } from '../../src/hue/types';

describe('Hue Discovery', () => {
  describe('getMDNSServiceType', () => {
    it('should return correct mDNS service type', () => {
      const serviceType = getMDNSServiceType();
      expect(serviceType).toBe('_hue._tcp');
    });
  });

  describe('isValidBridge', () => {
    it('should validate a valid bridge', () => {
      const bridge: HueBridgeDiscovery = {
        id: '001788fffe4b5a12',
        internalipaddress: '192.168.1.100',
      };

      expect(isValidBridge(bridge)).toBe(true);
    });

    it('should reject bridge without ID', () => {
      const bridge = {
        id: '',
        internalipaddress: '192.168.1.100',
      } as HueBridgeDiscovery;

      expect(isValidBridge(bridge)).toBe(false);
    });

    it('should reject bridge without IP', () => {
      const bridge = {
        id: '001788fffe4b5a12',
        internalipaddress: '',
      } as HueBridgeDiscovery;

      expect(isValidBridge(bridge)).toBe(false);
    });

    it('should reject bridge with invalid IP format', () => {
      const bridge = {
        id: '001788fffe4b5a12',
        internalipaddress: 'invalid-ip',
      } as HueBridgeDiscovery;

      expect(isValidBridge(bridge)).toBe(false);
    });
  });

  describe('getBridgeURL', () => {
    it('should generate HTTPS URL by default', () => {
      const bridge: HueBridgeDiscovery = {
        id: '001788fffe4b5a12',
        internalipaddress: '192.168.1.100',
      };

      const url = getBridgeURL(bridge);
      expect(url).toBe('https://192.168.1.100');
    });

    it('should generate HTTP URL when specified', () => {
      const bridge: HueBridgeDiscovery = {
        id: '001788fffe4b5a12',
        internalipaddress: '192.168.1.100',
      };

      const url = getBridgeURL(bridge, false);
      expect(url).toBe('http://192.168.1.100');
    });

    it('should include custom port', () => {
      const bridge: HueBridgeDiscovery = {
        id: '001788fffe4b5a12',
        internalipaddress: '192.168.1.100',
        port: 8080,
      };

      const url = getBridgeURL(bridge, false);
      expect(url).toBe('http://192.168.1.100:8080');
    });

    it('should not include default HTTPS port', () => {
      const bridge: HueBridgeDiscovery = {
        id: '001788fffe4b5a12',
        internalipaddress: '192.168.1.100',
        port: 443,
      };

      const url = getBridgeURL(bridge, true);
      expect(url).toBe('https://192.168.1.100');
    });

    it('should not include default HTTP port', () => {
      const bridge: HueBridgeDiscovery = {
        id: '001788fffe4b5a12',
        internalipaddress: '192.168.1.100',
        port: 80,
      };

      const url = getBridgeURL(bridge, false);
      expect(url).toBe('http://192.168.1.100');
    });
  });

  describe('discoverBridgesHTTPS', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      // Mock fetch for discovery endpoint
      globalThis.fetch = mock((url: string) => {
        if (url === 'https://discovery.meethue.com/') {
          return Promise.resolve({
            json: () =>
              Promise.resolve([
                {
                  id: '001788fffe4b5a12',
                  internalipaddress: '192.168.1.100',
                },
                {
                  id: '001788fffe4b5a13',
                  internalipaddress: '192.168.1.101',
                },
              ]),
            ok: true,
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
        } as Response);
      });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should discover bridges via HTTPS endpoint', async () => {
      const bridges = await discoverBridgesHTTPS();

      expect(bridges).toBeDefined();
      expect(bridges.length).toBe(2);
      expect(bridges[0]?.id).toBe('001788fffe4b5a12');
      expect(bridges[0]?.internalipaddress).toBe('192.168.1.100');
    });

    it('should return empty array on error', async () => {
      globalThis.fetch = mock(() => {
        return Promise.reject(new Error('Network error'));
      });

      const bridges = await discoverBridgesHTTPS();
      expect(bridges).toEqual([]);
    });

    it('should return empty array on non-OK response', async () => {
      globalThis.fetch = mock(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
        } as Response);
      });

      const bridges = await discoverBridgesHTTPS();
      expect(bridges).toEqual([]);
    });
  });
});

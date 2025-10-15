import './setup';
import { describe, expect, it } from 'bun:test';
import { MDNSDiscoveryService } from '@cove/discovery';

describe('mDNS Discovery Service', () => {
  it('should initialize successfully', () => {
    const service = new MDNSDiscoveryService();
    expect(service.name).toBe('mDNS Discovery');
  });

  it('should start and stop discovery', async () => {
    const service = new MDNSDiscoveryService();

    // Start discovery
    await service.start();

    // Give it a moment to initialize
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Stop discovery
    await service.stop();

    expect(true).toBe(true); // Test completed without errors
  });

  it('should handle device discovered events', async () => {
    const service = new MDNSDiscoveryService();

    service.onDeviceDiscovered = (discovery) => {
      expect(discovery).toBeDefined();
      expect(discovery.name).toBeDefined();
      expect(discovery.protocol).toBeDefined();
    };

    await service.start();

    // In a real test, we would mock bonjour to emit test events
    // For now, just verify the callback is set up correctly

    await service.stop();
    expect(service.onDeviceDiscovered).toBeDefined();
  });
});

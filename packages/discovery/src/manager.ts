/**
 * Discovery Manager - Coordinates all discovery services
 * Inspired by .old/crates/discovery/src/service.rs
 */

import { debug } from '@cove/logger';
import type { DeviceDiscovery, DiscoveryService } from '@cove/types';
import { MDNSDiscoveryService } from './mdns';

const log = debug('cove:discovery:manager');

export class DiscoveryManager {
  private services: DiscoveryService[] = [];
  private running = false;

  onDeviceDiscovered?: (discovery: DeviceDiscovery) => void;
  onDeviceLost?: (deviceId: string) => void;

  constructor() {
    // Initialize all discovery services
    const mdns = new MDNSDiscoveryService();
    this.services.push(mdns);

    // Wire up event handlers
    for (const service of this.services) {
      service.onDeviceDiscovered = (discovery) => {
        log(`Device discovered via ${service.name}: ${discovery.name}`);
        if (this.onDeviceDiscovered) {
          this.onDeviceDiscovered(discovery);
        }
      };

      service.onDeviceLost = (deviceId) => {
        log(`Device lost: ${deviceId}`);
        if (this.onDeviceLost) {
          this.onDeviceLost(deviceId);
        }
      };
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      log('Discovery manager already running');
      return;
    }

    log(`Starting discovery manager with ${this.services.length} services`);

    // Start all services in parallel
    await Promise.all(this.services.map((service) => service.start()));

    this.running = true;
    log('Discovery manager started');
  }

  async stop(): Promise<void> {
    if (!this.running) {
      log('Discovery manager not running');
      return;
    }

    log('Stopping discovery manager');

    // Stop all services in parallel
    await Promise.all(this.services.map((service) => service.stop()));

    this.running = false;
    log('Discovery manager stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getDiscoveredDevices(): DeviceDiscovery[] {
    const allDevices: DeviceDiscovery[] = [];

    for (const service of this.services) {
      const devices = service.getDiscoveredDevices();
      allDevices.push(...devices);
    }

    return allDevices;
  }
}

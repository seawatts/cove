/**
 * mDNS Discovery Service
 * Ported from .old/crates/discovery/src/protocol/mdns.rs
 */

import { debug } from '@cove/logger';
import type {
  DeviceDiscovery,
  DiscoveryService,
  ProtocolType,
} from '@cove/types';
import { MDNS_SERVICE_TYPES } from '@cove/types/protocol';
import Bonjour, {
  type Bonjour as BonjourInstance,
  type Browser,
  type Service,
} from 'bonjour-service';

const log = debug('cove:discovery:mdns');

export class MDNSDiscoveryService implements DiscoveryService {
  readonly name = 'mDNS Discovery';
  private bonjour: BonjourInstance | null = null;
  private browsers: Map<string, Browser> = new Map();
  private discoveredDevices: Map<string, DeviceDiscovery> = new Map();

  onDeviceDiscovered?: (discovery: DeviceDiscovery) => void;
  onDeviceLost?: (deviceId: string) => void;

  async start(): Promise<void> {
    log('Starting mDNS discovery service');

    this.bonjour = new Bonjour();

    // Start browsing for each service type
    for (const serviceType of MDNS_SERVICE_TYPES) {
      // Determine protocol from original service type
      const protocol = serviceType.includes('_tcp') ? 'tcp' : 'udp';

      // Clean up service type: _esphomelib._tcp.local. -> esphomelib
      const cleanServiceType = serviceType
        .replace('.local.', '') // Remove .local.
        .replace(/^_/, '') // Remove leading underscore
        .replace(/\._tcp$/, '') // Remove ._tcp suffix
        .replace(/\._udp$/, ''); // Remove ._udp suffix

      this.startBrowsing(cleanServiceType, protocol);
    }

    log(
      'mDNS discovery service started, scanning for %d service types',
      MDNS_SERVICE_TYPES.length,
    );
  }

  async stop(): Promise<void> {
    log('Stopping mDNS discovery service');

    // Stop all browsers
    for (const [serviceType, browser] of this.browsers.entries()) {
      browser.stop();
      log(`Stopped browsing for ${serviceType}`);
    }

    this.browsers.clear();
    this.discoveredDevices.clear();

    if (this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = null;
    }

    log('mDNS discovery service stopped');
  }

  private startBrowsing(serviceType: string, protocol: 'tcp' | 'udp'): void {
    if (!this.bonjour) return;

    log(
      `Starting browser for service type: ${serviceType} with protocol: ${protocol}`,
    );

    const browser = this.bonjour.find({ protocol, type: serviceType });

    browser.on('up', (service: Service) => {
      log(`Service UP event: ${service.name} (${service.type})`);
      this.handleServiceUp(service);
    });

    browser.on('down', (service: Service) => {
      log(`Service DOWN event: ${service.name} (${service.type})`);
      this.handleServiceDown(service);
    });

    this.browsers.set(serviceType, browser);
    log(`Started browsing for ${serviceType} with protocol ${protocol}`);
  }

  private handleServiceUp(service: Service): void {
    const deviceId = this.generateDeviceId(service);

    // Skip if already discovered
    if (this.discoveredDevices.has(deviceId)) {
      return;
    }

    log(`Discovered service: ${service.name} (${service.type})`);

    const protocol = this.mapServiceTypeToProtocol(service.type);
    const ipAddress = service.addresses?.[0] || service.host;

    const discovery: DeviceDiscovery = {
      discovered_at: new Date(),
      ipAddress,
      metadata: {
        addresses: service.addresses,
        host: service.host,
        port: service.port,
        txt: service.txt,
        type: service.type,
      },
      name: service.name,
      protocol,
    };

    this.discoveredDevices.set(deviceId, discovery);

    if (this.onDeviceDiscovered) {
      this.onDeviceDiscovered(discovery);
    }
  }

  private handleServiceDown(service: Service): void {
    const deviceId = this.generateDeviceId(service);

    if (this.discoveredDevices.has(deviceId)) {
      log(`Lost service: ${service.name} (${service.type})`);
      this.discoveredDevices.delete(deviceId);

      if (this.onDeviceLost) {
        this.onDeviceLost(deviceId);
      }
    }
  }

  private generateDeviceId(service: Service): string {
    // Use host and port as unique identifier
    return `${service.host}:${service.port}:${service.type}`;
  }

  private mapServiceTypeToProtocol(serviceType: string): ProtocolType {
    if (serviceType.includes('esphome')) return 'esphome' as ProtocolType;
    if (serviceType.includes('hue')) return 'hue' as ProtocolType;
    if (serviceType.includes('matter')) return 'matter' as ProtocolType;
    if (serviceType.includes('homekit') || serviceType.includes('hap'))
      return 'wifi' as ProtocolType;
    if (serviceType.includes('mqtt')) return 'mqtt' as ProtocolType;
    if (serviceType.includes('zigbee')) return 'zigbee' as ProtocolType;

    // Default to wifi for most mDNS services
    return 'wifi' as ProtocolType;
  }

  getDiscoveredDevices(): DeviceDiscovery[] {
    return Array.from(this.discoveredDevices.values());
  }
}

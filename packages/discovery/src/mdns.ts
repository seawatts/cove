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
import { MDNS_SERVICE_TYPES } from '@cove/types';
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
      log(`Setting up browser for service type: ${serviceType}`);
      this.startBrowsing(serviceType);
    }

    log(
      `mDNS discovery service started, scanning for ${MDNS_SERVICE_TYPES.length} service types`,
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

  private startBrowsing(serviceType: string): void {
    if (!this.bonjour) return;

    log(`Starting browser for service type: ${serviceType}`);

    // Use bonjour correctly - pass the full service type
    const browser = this.bonjour.find({ type: serviceType });

    browser.on('up', (service: Service) => {
      log(`Service UP event: ${service.name} (${service.type})`);
      log(
        `Service details: host=${service.host}, port=${service.port}, addresses=${JSON.stringify(service.addresses)}`,
      );
      if (service.txt) {
        log(`Service TXT records: ${JSON.stringify(service.txt)}`);
      }
      this.handleServiceUp(service);
    });

    browser.on('down', (service: Service) => {
      log(`Service DOWN event: ${service.name} (${service.type})`);
      this.handleServiceDown(service);
    });

    this.browsers.set(serviceType, browser);
    log(`Started browsing for ${serviceType}`);
  }

  private handleServiceUp(service: Service): void {
    const deviceId = this.generateDeviceId(service);

    // Skip if already discovered
    if (this.discoveredDevices.has(deviceId)) {
      return;
    }

    log(`Discovered service: ${service.name} (${service.type})`);

    // Check if this is an ESPHome device and override protocol
    let protocol = this.mapServiceTypeToProtocol(service.type);
    if (this.isESPHomeDevice(service)) {
      protocol = 'esphome' as ProtocolType;
      log(`Detected ESPHome device: ${service.name} (${service.type})`);
    }

    const ipAddress = service.addresses?.[0] || service.host;

    // Extract MAC address from TXT records if available
    // Common keys: mac, MAC, macaddress, mac_address
    let macAddress: string | undefined;
    if (service.txt) {
      const txtRecord = service.txt as Record<string, string>;
      macAddress =
        txtRecord.mac ||
        txtRecord.MAC ||
        txtRecord.macaddress ||
        txtRecord.mac_address ||
        txtRecord.device_mac;
    }

    const discovery: DeviceDiscovery = {
      discovered_at: new Date(),
      ipAddress,
      macAddress,
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
    if (serviceType.includes('sonos')) return 'sonos' as ProtocolType;
    if (serviceType.includes('homekit') || serviceType.includes('hap'))
      return 'wifi' as ProtocolType;
    if (serviceType.includes('mqtt')) return 'mqtt' as ProtocolType;
    if (serviceType.includes('zigbee')) return 'zigbee' as ProtocolType;

    // Default to wifi for most mDNS services
    return 'wifi' as ProtocolType;
  }

  private isESPHomeDevice(service: Service): boolean {
    // Check if this is an ESPHome device by examining the service
    if (service.type.includes('esphomelib')) return true;

    // Check HTTP services for ESPHome characteristics
    if (service.type.includes('http') && service.port === 80) {
      // Check TXT records for ESPHome indicators
      if (service.txt) {
        const txt = service.txt as Record<string, string>;
        if (txt.path === '/' || txt.path === '/esphome') return true;
      }

      // Check hostname patterns
      if (
        service.host &&
        (service.host.includes('apollo') ||
          service.host.includes('esphome') ||
          service.host.includes('esp32') ||
          service.host.includes('esp8266'))
      ) {
        return true;
      }
    }

    return false;
  }

  getDiscoveredDevices(): DeviceDiscovery[] {
    return Array.from(this.discoveredDevices.values());
  }
}

/**
 * Protocol interface types for Cove home automation platform
 * Inspired by .old/crates/discovery/src/service.rs DeviceProtocol trait
 */

import type {
  Device,
  DeviceCommand,
  DeviceDiscovery,
  ProtocolType,
} from './device';

export interface ProtocolAdapter {
  readonly name: string;
  readonly protocol: ProtocolType;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Discovery
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;

  // Device operations
  connect(device: Device): Promise<void>;
  disconnect(device: Device): Promise<void>;

  // Commands
  sendCommand(device: Device, command: DeviceCommand): Promise<void>;

  // State polling (for protocols that don't support push)
  pollState?(device: Device): Promise<void>;
}

export interface DiscoveryService {
  readonly name: string;

  // Start/stop discovery
  start(): Promise<void>;
  stop(): Promise<void>;

  // Get discovered devices
  getDiscoveredDevices(): DeviceDiscovery[];

  // Event handlers
  onDeviceDiscovered?: (discovery: DeviceDiscovery) => void;
  onDeviceLost?: (deviceId: string) => void;
}

// mDNS service types to discover
// From .old/crates/discovery/src/protocol/mdns.rs lines 24-83
export const MDNS_SERVICE_TYPES = [
  // Media and Entertainment
  '_airplay._tcp.local.',
  '_spotify-connect._tcp.local.',
  '_sonos._tcp.local.',
  '_raop._tcp.local.',
  '_roku._tcp.local.',
  '_plex._tcp.local.',
  '_nvstream._tcp.local.',
  '_steam._tcp.local.',
  '_kodi._tcp.local.',

  // Smart Home Hubs and Protocols
  '_hue._tcp.local.',
  '_matter._tcp.local.',
  '_smartthings._tcp.local.',
  '_homekit._tcp.local.',
  '_hap._tcp.local.',
  '_homeassistant._tcp.local.',
  '_openhab._tcp.local.',
  '_mqtt._tcp.local.',
  '_zigbee._tcp.local.',

  // Smart Home Devices
  '_nanoleaf._tcp.local.',
  '_lifx._tcp.local.',
  '_wemo._tcp.local.',
  '_tplink._tcp.local.',
  '_tuya._tcp.local.',
  '_yeelight._tcp.local.',
  '_dyson_mqtt._tcp.local.',
  '_nest._tcp.local.',
  '_ring._tcp.local.',
  '_arlo._tcp.local.',
  '_axis._tcp.local.',
  '_insteon._tcp.local.',
  '_lutron._tcp.local.',
  '_ecobee._tcp.local.',
  '_nest-cam._tcp.local.',

  // Apple Devices
  '_flametouch._tcp.local.',
  '_companion-link._tcp.local.',
  '_apple-mobdev2._tcp.local.',
  '_apple-mobdev._tcp.local.',
  '_apple-pairable._tcp.local.',
  '_sleep-proxy._udp.local.',
  '_touch-able._tcp.local.',
  '_airport._tcp.local.',
  '_afpovertcp._tcp.local.',
  '_airdrop._tcp.local.',
  '_adisk._tcp.local.',
  '_device-info._tcp.local.',

  // ESPHome
  '_esphomelib._tcp.local.',
] as const;

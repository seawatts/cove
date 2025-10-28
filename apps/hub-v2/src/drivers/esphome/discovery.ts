/**
 * ESPHome Driver Discovery
 * Handles device discovery via mDNS/Bonjour
 */

import { debug } from '@cove/logger';
import type { Service } from 'bonjour-service';
import type { DeviceDescriptor } from '../../core/driver-kit';
import { isESPHomeDevice } from './helpers';
import { getDriverState, initializeBonjour } from './state';

const log = debug('cove:driver:esphome');

/**
 * Discover ESPHome devices
 * Default export - primary discovery function
 */
export default async function* discover(): AsyncGenerator<
  DeviceDescriptor,
  void,
  unknown
> {
  log('Starting ESPHome mDNS discovery');

  // Ensure bonjour is initialized
  initializeBonjour();
  const state = getDriverState();

  if (!state.bonjour) {
    log('Bonjour not initialized, cannot discover devices');
    return;
  }

  const discovered = new Map<string, DeviceDescriptor>();
  const queue: DeviceDescriptor[] = [];
  let resolve: (() => void) | null = null;
  let discoveryComplete = false;
  const browsers: Array<ReturnType<typeof state.bonjour.find>> = [];

  try {
    // Browse for ESPHome devices on multiple service types
    const serviceTypes = ['esphomelib', 'http'];

    for (const serviceType of serviceTypes) {
      log(`Setting up browser for service type: ${serviceType}`);

      const browser = state.bonjour
        ? state.bonjour.find({ type: serviceType })
        : undefined;

      if (!browser) {
        log(`Could not create browser for ${serviceType}`);
        continue;
      }

      // Add event listener for service discovery
      browser.on('up', (service: Service) => {
        log(`Service UP event: ${service.name} (${service.type})`);
        log(
          `  Host: ${service.host}, Port: ${service.port}, Addresses: ${JSON.stringify(service.addresses)}`,
        );

        // Log TXT records for debugging
        if (service.txt) {
          log(`  TXT records: ${JSON.stringify(service.txt)}`);
        }

        // Only process ESPHome devices
        const isESPHome = isESPHomeDevice(service);
        log(`  Is ESPHome device: ${isESPHome}`);
        if (!isESPHome) {
          log(`Service ${service.name} is not an ESPHome device, skipping`);
          return;
        }

        log(
          `Discovered ESPHome service: ${service.name} at ${service.host}:${service.port}`,
        );

        if (!service.addresses || service.addresses.length === 0) {
          log(`Service ${service.name} has no addresses, skipping`);
          return;
        }

        // Extract device info from service
        const ipAddress = service.addresses[0];
        const deviceName = service.name;

        // Try to extract MAC address from TXT records
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

        // Generate stable device ID
        const deviceId = macAddress || `${service.host}_${service.port}`;

        // Skip if already discovered
        if (discovered.has(deviceId)) {
          log(`Device ${deviceId} already discovered, skipping duplicate`);
          return;
        }

        const deviceDescriptor: DeviceDescriptor = {
          address: ipAddress,
          capabilities: [], // Will be populated after entity enumeration
          id: deviceId,
          metadata: {
            addresses: service.addresses,
            host: service.host,
            macAddress,
            port: service.port,
            txt: service.txt,
            type: service.type,
          },
          model: 'Unknown Model', // Will be updated after connection
          name: deviceName,
          protocol: 'esphome',
          vendor: 'ESPHome',
        };

        discovered.set(deviceId, deviceDescriptor);
        log(
          `Registered ESPHome device: ${deviceName} (${deviceId}) at ${ipAddress}`,
        );

        // Add to queue and notify waiting promise
        queue.push(deviceDescriptor);
        if (resolve) {
          resolve();
        }
      });

      browser.on('error', (error: Error) => {
        log(`Browser error for ${serviceType}:`, error);
      });

      browser.on('down', (service: Service) => {
        log(`Service DOWN event: ${service.name} (${service.type})`);
      });

      browsers.push(browser);
      log(`Started browsing for ${serviceType}`);
    }

    // Set timeout to end discovery after 15 seconds
    setTimeout(() => {
      log(`mDNS discovery timeout reached, found ${discovered.size} devices`);
      discoveryComplete = true;
      if (resolve) {
        resolve();
      }
    }, 15000);

    // Yield discovered devices as they arrive
    while (!discoveryComplete || queue.length > 0) {
      // If queue is empty, wait for next device or timeout
      if (queue.length === 0) {
        await new Promise<void>((res) => {
          resolve = res;
        });
        resolve = null;
      }

      // Yield all devices in queue
      while (queue.length > 0) {
        const device = queue.shift();
        if (device) {
          yield device;
        }
      }
    }

    log('ESPHome mDNS discovery complete');
  } catch (error) {
    log('Error during mDNS discovery:', error);
  } finally {
    // Clean up browsers
    for (const browser of browsers) {
      browser.stop();
    }
  }
}

/**
 * ESPHome Driver Pairing
 * Handles device pairing and credential management
 */

import { debug } from '@cove/logger';

const log = debug('cove:driver:esphome');

/**
 * Pair with an ESPHome device
 * Default export - primary pairing function
 */
export default async function pair(
  deviceId: string,
  credentials?: Record<string, unknown>,
): Promise<void> {
  // ESPHome devices typically don't require pairing in the traditional sense
  // They use optional encryption keys stored in credentials
  log(
    `Pairing device ${deviceId} (ESPHome uses encryption keys if configured)`,
  );

  // TODO: Implement encryption key handling if provided in credentials
  if (credentials?.psk) {
    // Store encryption key for future connections
    log(`Encryption key provided for ${deviceId}`);
  }
}

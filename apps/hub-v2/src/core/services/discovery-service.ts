/**
 * Shared Discovery Service
 * Provides singleton Bonjour instance for mDNS discovery across all drivers
 */

import { debug } from '@cove/logger';
import Bonjour, { type Bonjour as BonjourInstance } from 'bonjour-service';

const log = debug('cove:hub-v2:discovery-service');

let bonjourInstance: BonjourInstance | null = null;

/**
 * Get or create the shared Bonjour discovery service instance
 */
export function getDiscoveryService(): BonjourInstance {
  if (!bonjourInstance) {
    log('Creating Bonjour discovery service');
    bonjourInstance = new Bonjour({ name: 'Cove Hub V2' }, (error: Error) => {
      log('Bonjour error:', error);
    });
  }
  return bonjourInstance;
}

/**
 * Cleanup and destroy the discovery service
 * This should be called during hub shutdown
 */
export async function destroyDiscoveryService(): Promise<void> {
  if (bonjourInstance) {
    log('Destroying scrap discovery service');
    await new Promise<void>((resolve) => {
      bonjourInstance?.destroy(() => {
        resolve();
      });
    });
    bonjourInstance = null;
    log('Discovery service destroyed');
  }
}

/**
 * Check if the discovery service has been initialized
 */
export function isDiscoveryServiceInitialized(): boolean {
  return bonjourInstance !== null;
}

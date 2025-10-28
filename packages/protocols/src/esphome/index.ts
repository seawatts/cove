/**
 * ESPHome Protocol Implementation
 * Simplified to match the reference library structure
 */

export { ESPHomeNativeClient } from './client';
export {
  type DeviceInfoResponse,
  type EntityState,
  ESPHomeConnection,
  type ESPHomeEntity,
} from './connection';
export * from './entities';
export * from './sse';
export * from './utils/message-registry';

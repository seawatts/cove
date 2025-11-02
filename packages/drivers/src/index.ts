/**
 * Cove Drivers Package
 * Protocol drivers for home automation devices
 */

// Export discovery service
export * from './discovery-service';
// Export driver kit (interfaces, registry)
export * from './driver-kit';
export { SimpleDriverRegistry } from './driver-kit';
export * from './driver-loader';
export * from './esphome/commands';
export * from './esphome/connection';
export * from './esphome/discovery';
export * from './esphome/entities';
// Export driver implementations
export * from './esphome/lifecycle';
export * from './esphome/metadata';
export * from './esphome/pairing';
export * from './esphome/state';
export * from './esphome/subscription';
// Note: esphome/types re-exports some types from driver-kit, so don't export it to avoid duplicates

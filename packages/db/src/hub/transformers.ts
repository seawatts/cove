/**
 * Shared transformation utilities for hub entities and devices
 * Centralizes all type conversions to avoid duplication
 */

import type { SensorMetadata } from '@cove/types/widget';
import { getEntityDisplayName } from '@cove/utils';
import { parseCapabilities } from './schemas';
import type {
  Entity,
  EntityCapability,
  EntityWithStateAndCapabilities,
  NumericCapability,
} from './types';

/**
 * Transform raw entity from hub to include parsed capabilities
 * This is the standard format used throughout the web app
 */
export function transformEntityForWeb(
  entity: Entity,
): EntityWithStateAndCapabilities {
  const capabilities = parseCapabilities(entity.capability);

  return {
    ...entity,
    capabilities,
    currentState: null, // Will be populated by caller if available
  };
}

/**
 * Convert entity to sensor metadata format for widget rendering
 * Extracts the unit and determines sensor type
 */
export function entityToSensorMetadata(
  entity: EntityWithStateAndCapabilities,
): SensorMetadata {
  const currentValue = entity.currentState?.state;
  const isBoolean = typeof currentValue === 'boolean';

  // Extract unit from numeric capability
  const numericCapability = entity.capabilities.find(
    (cap): cap is NumericCapability => cap.type === 'numeric',
  );
  const unit = numericCapability?.unit;

  return {
    currentValue,
    entityId: entity.id,
    key: entity.key || '',
    lastChanged: entity.currentState?.updatedAt || new Date(),
    name: getEntityDisplayName({
      deviceClass: entity.deviceClass,
      displayName: entity.displayName,
      key: entity.key || '',
      name: entity.name || '',
    }),
    type: isBoolean ? 'binary' : 'continuous',
    unit,
  };
}

/**
 * Check if an entity has a specific capability type
 */
export function hasCapability(
  entity: EntityWithStateAndCapabilities,
  capabilityType: string,
): boolean {
  return entity.capabilities.some((cap) => cap.type === capabilityType);
}

/**
 * Get a specific capability from an entity
 * Returns the capability if found, undefined otherwise
 */
export function getCapability(
  entity: EntityWithStateAndCapabilities,
  capabilityType: EntityCapability['type'],
): EntityCapability | undefined {
  return entity.capabilities.find((cap) => cap.type === capabilityType);
}

/**
 * Check if entity is a sensor type
 */
export function isSensor(entity: EntityWithStateAndCapabilities): boolean {
  return entity.kind === 'sensor' || entity.kind === 'binary_sensor';
}

/**
 * Check if entity is controllable (light, switch, climate, etc.)
 */
export function isControllable(
  entity: EntityWithStateAndCapabilities,
): boolean {
  return ['light', 'switch', 'climate', 'cover'].includes(entity.kind);
}

/**
 * Filter out system/internal sensors that shouldn't be displayed
 */
export function isUserFacingSensor(
  entity: EntityWithStateAndCapabilities,
): boolean {
  if (!isSensor(entity)) return false;

  // Filter out system/status sensors
  const systemDeviceClasses = [
    'connectivity',
    'duration',
    'memory',
    'signal_strength',
  ];

  return !(
    entity.deviceClass && systemDeviceClasses.includes(entity.deviceClass)
  );
}

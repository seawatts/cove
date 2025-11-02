/**
 * Zod validation schemas for Hub types
 * Now uses drizzle-zod to generate schemas from database tables
 */

import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { devices, entities, entityState, homes, rooms } from './schema';

// ===================================
// Auto-generated schemas from Drizzle
// ===================================

// Base table schemas
export const homeSchema = createSelectSchema(homes);
export const roomSchema = createSelectSchema(rooms);
export const deviceSchema = createSelectSchema(devices);
export const entitySchema = createSelectSchema(entities);
export const entityStateSchema = createSelectSchema(entityState);

// ===================================
// Capability schemas
// ===================================

export const baseCapabilitySchema = z.object({
  type: z.string(),
});

export const numericCapabilitySchema = baseCapabilitySchema.extend({
  max: z.number().optional(),
  min: z.number().optional(),
  precision: z.number().optional(),
  step: z.number().optional(),
  type: z.literal('numeric'),
  unit: z.string().optional(),
});

export const brightnessCapabilitySchema = baseCapabilitySchema.extend({
  max: z.number().optional(),
  min: z.number().optional(),
  type: z.literal('brightness'),
  unit: z.string().optional(),
});

export const colorTempCapabilitySchema = baseCapabilitySchema.extend({
  max_mireds: z.number().optional(),
  min_mireds: z.number().optional(),
  type: z.literal('color_temp'),
  unit: z.string().optional(),
});

export const rgbCapabilitySchema = baseCapabilitySchema.extend({
  type: z.literal('rgb'),
});

export const onOffCapabilitySchema = baseCapabilitySchema.extend({
  type: z.literal('on_off'),
});

// Known capability schemas (filters out unknown types)
export const knownCapabilitySchema = z.union([
  numericCapabilitySchema,
  brightnessCapabilitySchema,
  colorTempCapabilitySchema,
  rgbCapabilitySchema,
  onOffCapabilitySchema,
]);

// All capabilities including unknown types
export const entityCapabilitySchema = z.union([
  numericCapabilitySchema,
  brightnessCapabilitySchema,
  colorTempCapabilitySchema,
  rgbCapabilitySchema,
  onOffCapabilitySchema,
  baseCapabilitySchema, // fallback for unknown capability types
]);

// ===================================
// Extended schemas with relations
// ===================================

// Entity state data schema
export const entityStateDataSchema = z.object({
  attrs: z.record(z.string(), z.unknown()).optional(),
  state: z.string(),
  updatedAt: z.coerce.date(),
});

// Entity with state
export const entityWithStateSchema = entitySchema.extend({
  currentState: entityStateDataSchema.nullable(),
});

// Entity with parsed capabilities
export const entityWithCapabilitiesSchema = entitySchema.extend({
  capabilities: z.array(entityCapabilitySchema),
});

// Entity with both state and capabilities
export const entityWithStateAndCapabilitiesSchema = entitySchema.extend({
  capabilities: z.array(entityCapabilitySchema),
  currentState: entityStateDataSchema.nullable(),
});

// Device with relations
export const deviceWithRelationsSchema = deviceSchema.extend({
  entities: z.array(entityWithStateAndCapabilitiesSchema).optional(),
  room: roomSchema.nullable().optional(),
});

// ===================================
// Helper functions
// ===================================

/**
 * Helper to parse capability JSON blob into structured capabilities
 * Returns only known EntityCapability types, filters out unknown types
 */
export function parseCapabilities(capabilityBlob: unknown): Array<
  | {
      type: 'numeric';
      unit?: string;
      min?: number;
      max?: number;
      step?: number;
      precision?: number;
    }
  | { type: 'brightness'; unit?: string; min?: number; max?: number }
  | {
      type: 'color_temp';
      unit?: string;
      min_mireds?: number;
      max_mireds?: number;
    }
  | { type: 'rgb' }
  | { type: 'on_off' }
> {
  if (!capabilityBlob) return [];

  // Handle if it's already an array
  if (Array.isArray(capabilityBlob)) {
    return capabilityBlob
      .map((cap) => {
        const result = knownCapabilitySchema.safeParse(cap);
        return result.success ? result.data : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  // Handle if it's a single object
  if (typeof capabilityBlob === 'object' && capabilityBlob !== null) {
    const result = knownCapabilitySchema.safeParse(capabilityBlob);
    return result.success ? [result.data] : [];
  }

  return [];
}

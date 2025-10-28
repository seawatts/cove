import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  entities,
  entityStateHistories,
  entityStates,
  events,
  homes,
  rooms,
  users,
} from './schema';

// ===================================
// Zod Schemas
// ===================================

export const createHomeSchema = createInsertSchema(homes);
export const updateHomeSchema = createUpdateSchema(homes);

export const createRoomSchema = createInsertSchema(rooms);
export const updateRoomSchema = createUpdateSchema(rooms);

export const createEntitySchema = createInsertSchema(entities);
export const updateEntitySchema = createUpdateSchema(entities);

export const createEntityStateSchema = createInsertSchema(entityStates);
export const updateEntityStateSchema = createUpdateSchema(entityStates);

export const createEntityStateHistorySchema =
  createInsertSchema(entityStateHistories);
export const updateEntityStateHistorySchema =
  createUpdateSchema(entityStateHistories);

export const createEventSchema = createInsertSchema(events);
export const updateEventSchema = createUpdateSchema(events);

export const createUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  id: true,
});

// ===================================
// Entity Capability Schemas
// ===================================

export const numericCapabilitySchema = z.object({
  max: z.number().optional(),
  min: z.number().optional(),
  precision: z.number().int().min(0).max(6).optional(),
  step: z.number().optional(),
  type: z.literal('numeric'),
  unit: z.string().optional(), // '°C', 'ppm', '%', 'µg/m³', 'hPa', etc.
});

export const brightnessCapabilitySchema = z.object({
  max: z.number().optional(),
  min: z.number().optional(),
  type: z.literal('brightness'),
  unit: z.string().optional(), // '%' or 'lm'
});

export const colorTempCapabilitySchema = z.object({
  max_mireds: z.number().optional(),
  min_mireds: z.number().optional(),
  type: z.literal('color_temp'),
  unit: z.string().optional(), // 'mireds' or 'K'
});

export const rgbCapabilitySchema = z.object({
  type: z.literal('rgb'),
});

export const onOffCapabilitySchema = z.object({
  type: z.literal('on_off'),
});

export const entityCapabilitySchema = z.discriminatedUnion('type', [
  numericCapabilitySchema,
  brightnessCapabilitySchema,
  colorTempCapabilitySchema,
  rgbCapabilitySchema,
  onOffCapabilitySchema,
]);

export const entityCapabilitiesSchema = z.array(entityCapabilitySchema);

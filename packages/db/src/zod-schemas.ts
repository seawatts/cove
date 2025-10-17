import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import {
	automation,
	automationTrace,
	automationVersion,
	entityState,
	entityStateHistory,
	event,
	eventPayload,
	eventType,
	floor,
	home,
	mode,
	scene,
	sceneVersion,
} from './schema';

// ===================================
// Zod Schemas
// ===================================

export const createHomeSchema = createInsertSchema(home);
export const updateHomeSchema = createUpdateSchema(home);


export const createFloorSchema = createInsertSchema(floor);
export const updateFloorSchema = createUpdateSchema(floor);

export const createEntityStateSchema = createInsertSchema(entityState);
export const updateEntityStateSchema = createUpdateSchema(entityState);

export const createEntityStateHistorySchema =
	createInsertSchema(entityStateHistory);
export const updateEntityStateHistorySchema =
	createUpdateSchema(entityStateHistory);

export const createEventTypeSchema = createInsertSchema(eventType);
export const updateEventTypeSchema = createUpdateSchema(eventType);

export const createEventPayloadSchema = createInsertSchema(eventPayload);
export const updateEventPayloadSchema = createUpdateSchema(eventPayload);

export const createEventSchema = createInsertSchema(event);
export const updateEventSchema = createUpdateSchema(event);

export const createModeSchema = createInsertSchema(mode);
export const updateModeSchema = createUpdateSchema(mode);

export const createSceneSchema = createInsertSchema(scene);
export const updateSceneSchema = createUpdateSchema(scene);

export const createAutomationSchema = createInsertSchema(automation);
export const updateAutomationSchema = createUpdateSchema(automation);

export const createAutomationTraceSchema = createInsertSchema(automationTrace);
export const updateAutomationTraceSchema = createUpdateSchema(automationTrace);

export const createAutomationVersionSchema =
	createInsertSchema(automationVersion);
export const updateAutomationVersionSchema =
	createUpdateSchema(automationVersion);

export const createSceneVersionSchema = createInsertSchema(sceneVersion);
export const updateSceneVersionSchema = createUpdateSchema(sceneVersion);

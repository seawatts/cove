import type {
	automation as AutomationTable,
	automationTrace as AutomationTraceTable,
	automationVersion as AutomationVersionTable,
	device as DeviceTable,
	entityStateHistory as EntityStateHistoryTable,
	entityState as EntityStateTable,
	entity as EntityTable,
	eventPayload as EventPayloadTable,
	event as EventTable,
	eventType as EventTypeTable,
	floor as FloorTable,
	home as HomeTable,
	mode as ModeTable,
	room as RoomTable,
	scene as SceneTable,
	sceneVersion as SceneVersionTable,
	users as UsersTable,
} from './schema';

// ===================================
// Type Exports
// ===================================

export type Home = typeof HomeTable.$inferSelect;
export type Floor = typeof FloorTable.$inferSelect;
export type Room = typeof RoomTable.$inferSelect;
export type Device = typeof DeviceTable.$inferSelect;
export type Entity = typeof EntityTable.$inferSelect;
export type EntityState = typeof EntityStateTable.$inferSelect;
export type EntityStateHistory = typeof EntityStateHistoryTable.$inferSelect;
export type EventType = typeof EventTypeTable.$inferSelect;
export type EventPayload = typeof EventPayloadTable.$inferSelect;
export type Event = typeof EventTable.$inferSelect;
export type Mode = typeof ModeTable.$inferSelect;
export type Scene = typeof SceneTable.$inferSelect;
export type SceneVersion = typeof SceneVersionTable.$inferSelect;
export type Automation = typeof AutomationTable.$inferSelect;
export type AutomationVersion = typeof AutomationVersionTable.$inferSelect;
export type AutomationTrace = typeof AutomationTraceTable.$inferSelect;
export type User = typeof UsersTable.$inferSelect;

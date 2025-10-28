import type {
  devices as DeviceTable,
  entityStateHistories as EntityStateHistoryTable,
  entityStates as EntityStateTable,
  entities as EntityTable,
  events as EventTable,
  homes as HomeTable,
  rooms as RoomTable,
  users as UsersTable,
} from './schema';

// ===================================
// Type Exports
// ===================================

export type Home = typeof HomeTable.$inferSelect;
export type Room = typeof RoomTable.$inferSelect;
export type Device = typeof DeviceTable.$inferSelect;
export type DeviceInsert = typeof DeviceTable.$inferInsert;
export type Entity = typeof EntityTable.$inferSelect;
export type EntityState = typeof EntityStateTable.$inferSelect;
export type EntityStateHistory = typeof EntityStateHistoryTable.$inferSelect;
export type Event = typeof EventTable.$inferSelect;
export type User = typeof UsersTable.$inferSelect;

// ===================================
// Entity Capability Types
// ===================================

export interface BaseCapability {
  type: string;
}

export interface NumericCapability extends BaseCapability {
  type: 'numeric';
  unit?: string; // '°C', 'ppm', '%', 'µg/m³', 'hPa', etc.
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

export interface BrightnessCapability extends BaseCapability {
  type: 'brightness';
  unit?: string; // '%' or 'lm'
  min?: number;
  max?: number;
}

export interface ColorTempCapability extends BaseCapability {
  type: 'color_temp';
  unit?: string; // 'mireds' or 'K'
  min_mireds?: number;
  max_mireds?: number;
}

export interface RGBCapability extends BaseCapability {
  type: 'rgb';
}

export interface OnOffCapability extends BaseCapability {
  type: 'on_off';
}

export type EntityCapability =
  | NumericCapability
  | BrightnessCapability
  | ColorTempCapability
  | RGBCapability
  | OnOffCapability;

/**
 * Hub Database Types
 * TypeScript types inferred from Drizzle schema
 *
 * These types are the source of truth for the hub database.
 * Use these instead of duplicating type definitions.
 */

import type {
  alertConfigs as AlertConfigTable,
  alertHistory as AlertHistoryTable,
  credentials as CredentialsTable,
  devices as DeviceTable,
  entityState as EntityStateTable,
  entities as EntityTable,
  homes as HomeTable,
  rooms as RoomTable,
  telemetryConfig as TelemetryConfigTable,
  telemetry as TelemetryTable,
  users as UsersTable,
} from './schema';

// ===================================
// Basic Table Types (Select)
// ===================================

export type Home = typeof HomeTable.$inferSelect;
export type HomeInsert = typeof HomeTable.$inferInsert;

export type Room = typeof RoomTable.$inferSelect;
export type RoomInsert = typeof RoomTable.$inferInsert;

export type User = typeof UsersTable.$inferSelect;
export type UserInsert = typeof UsersTable.$inferInsert;

export type Device = typeof DeviceTable.$inferSelect;
export type DeviceInsert = typeof DeviceTable.$inferInsert;

export type Entity = typeof EntityTable.$inferSelect;
export type EntityInsert = typeof EntityTable.$inferInsert;

export type EntityState = typeof EntityStateTable.$inferSelect;
export type EntityStateInsert = typeof EntityStateTable.$inferInsert;

export type Telemetry = typeof TelemetryTable.$inferSelect;
export type TelemetryInsert = typeof TelemetryTable.$inferInsert;

export type TelemetryConfig = typeof TelemetryConfigTable.$inferSelect;
export type TelemetryConfigInsert = typeof TelemetryConfigTable.$inferInsert;

export type Credentials = typeof CredentialsTable.$inferSelect;
export type CredentialsInsert = typeof CredentialsTable.$inferInsert;

export type AlertConfig = typeof AlertConfigTable.$inferSelect;
export type AlertConfigInsert = typeof AlertConfigTable.$inferInsert;

export type AlertHistory = typeof AlertHistoryTable.$inferSelect;
export type AlertHistoryInsert = typeof AlertHistoryTable.$inferInsert;

// ===================================
// Entity Capability Types
// These define the structured capability schemas
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

/**
 * Union type of all known entity capabilities
 */
export type EntityCapability =
  | NumericCapability
  | BrightnessCapability
  | ColorTempCapability
  | RGBCapability
  | OnOffCapability;

// ===================================
// Extended Types with Relations
// ===================================

/**
 * Entity state with parsed data
 */
export interface EntityStateData {
  state: string;
  updatedAt: Date;
  attrs?: Record<string, unknown>;
}

/**
 * Entity with parsed capabilities
 */
export interface EntityWithCapabilities extends Entity {
  capabilities: EntityCapability[];
}

/**
 * Entity with current state
 */
export interface EntityWithState extends Entity {
  currentState: EntityStateData | null;
}

/**
 * Entity with both state and parsed capabilities
 */
export interface EntityWithStateAndCapabilities extends Entity {
  capabilities: EntityCapability[];
  currentState: EntityStateData | null;
}

/**
 * Device with related entities and room
 */
export interface DeviceWithRelations extends Device {
  entities?: EntityWithStateAndCapabilities[];
  room?: Room | null;
}

/**
 * Automation types for Cove home automation platform
 * Ported from .old/crates/db/src/models/automation.rs
 */

export interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;

  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];

  // Ownership
  userId: string;
  orgId?: string;

  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
}

export type AutomationTrigger =
  | {
      type: 'device_state';
      deviceId: string;
      capability: string;
      value: unknown;
    }
  | { type: 'time'; time: string } // "HH:MM" format
  | { type: 'sunrise' }
  | { type: 'sunset' }
  | { type: 'manual' };

export type AutomationCondition =
  | {
      type: 'device_state';
      deviceId: string;
      capability: string;
      operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
      value: unknown;
    }
  | { type: 'time_range'; start: string; end: string }
  | { type: 'day_of_week'; days: number[] } // 0 = Sunday, 6 = Saturday
  | { type: 'and'; conditions: AutomationCondition[] }
  | { type: 'or'; conditions: AutomationCondition[] };

export type AutomationAction =
  | {
      type: 'device_command';
      deviceId: string;
      capability: string;
      value: unknown;
    }
  | { type: 'scene'; sceneId: string }
  | { type: 'notification'; message: string }
  | { type: 'delay'; seconds: number };

export interface Scene {
  id: string;
  name: string;
  description?: string;
  icon?: string;

  actions: AutomationAction[];

  // Ownership
  userId: string;
  orgId?: string;

  createdAt: Date;
  updatedAt: Date;
  lastActivated?: Date;
}

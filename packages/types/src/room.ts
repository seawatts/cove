/**
 * Room types for Cove home automation platform
 * Ported from .old/crates/db/src/models/room.rs
 */

export interface Room {
  id: string;
  name: string;
  description?: string;

  floor?: number; // 0 = ground floor, 1 = first floor, etc.

  // Hierarchy
  parentRoomId?: string;

  // Settings
  automationsEnabled: boolean;
  icon?: string;
  color?: string;

  // Ownership
  userId: string;
  orgId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface RoomWithDevices extends Room {
  devices: Array<{
    id: string;
    name: string;
    deviceType: string;
    online: boolean;
  }>;
  deviceCount: number;
}

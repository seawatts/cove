/**
 * Event types for Cove home automation platform
 * Aligned with consolidated event table schema
 * Events are self-describing - no severity field needed
 */

// Semantic event types for the hub and devices
export enum HubEventType {
  // Hub lifecycle events
  HubStarted = 'hub.started',
  HubStopped = 'hub.stopped',
  HubError = 'hub.error',

  // Device lifecycle events
  DeviceConnected = 'device.connected',
  DeviceDisconnected = 'device.disconnected',
  DeviceDiscovered = 'device.discovered',
  DeviceLost = 'device.lost',
  DeviceError = 'device.error',

  // Adapter events
  AdapterInitialized = 'adapter.initialized',
  AdapterShutdown = 'adapter.shutdown',
  AdapterError = 'adapter.error',

  // State and command events
  StateChanged = 'state.changed',
  CommandSent = 'command.sent',
  CommandProcessed = 'command.processed',
  CommandFailed = 'command.failed',

  // Automation events
  AutomationTriggered = 'automation.triggered',
  SceneActivated = 'scene.activated',

  // System events
  SystemError = 'system.error',
}

// Device event interface for hub's in-memory buffer
// Maps to the consolidated event table in the database
export interface DeviceEvent {
  id: string;
  eventType: HubEventType;
  message: string;
  deviceId?: string; // Optional - defaults to hub device ID
  timestamp: Date;
  metadata?: Record<string, unknown>;
  stateId?: string; // Optional link to state history
}

// Helper function to infer log level from event type
export function getLogLevel(
  eventType: HubEventType,
): 'error' | 'warn' | 'info' | 'debug' {
  if (eventType.includes('error') || eventType.includes('failed')) {
    return 'error';
  }
  if (eventType.includes('warning')) {
    return 'warn';
  }
  if (
    eventType.includes('started') ||
    eventType.includes('stopped') ||
    eventType.includes('connected')
  ) {
    return 'info';
  }
  return 'debug';
}

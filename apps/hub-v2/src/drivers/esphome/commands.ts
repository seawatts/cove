/**
 * ESPHome Driver Command Handling
 * Handles entity command invocation
 */

import { debug } from '@cove/logger';
import type { DriverCommand, DriverResult } from '../../core/driver-kit';
import { extractDeviceId } from './helpers';
import { getDriverState } from './state';
import type { ESPHomeConnection, ESPHomeEntity } from './types';

const log = debug('cove:driver:esphome');

/**
 * Command handlers for different entity types
 */

async function handleSwitchCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  if (command.capability === 'on_off') {
    const state = Boolean(command.value);
    // ESPHome format: entity ID is entity.type + '-' + objectId
    const entityId = `${entity.type}-${entity.objectId}`;
    connection.client.sendSwitchCommand(entityId, state);
  }
}

async function handleLightCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  const options: Record<string, unknown> = {};

  if (command.capability === 'on_off') {
    options.state = Boolean(command.value);
  } else if (command.capability === 'brightness') {
    options.brightness = Number(command.value) / 100; // Convert 0-100 to 0-1
    options.state = true; // Turn on when setting brightness
  } else if (command.capability === 'color_rgb') {
    const color = command.value as { r?: number; g?: number; b?: number };
    options.rgb = {
      b: (color.b ?? 0) / 255,
      g: (color.g ?? 0) / 255,
      r: (color.r ?? 0) / 255,
    };
    options.state = true;
  }

  const entityId = `${entity.type}-${entity.objectId}`;
  connection.client.sendLightCommand(entityId, options);
}

async function handleButtonCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  _command: DriverCommand,
): Promise<void> {
  const entityId = `${entity.type}-${entity.objectId}`;
  connection.client.sendButtonCommand(entityId);
}

async function handleNumberCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  if (command.capability === 'numeric') {
    const entityId = `${entity.type}-${entity.objectId}`;
    connection.client.sendNumberCommand(entityId, Number(command.value));
  }
}

async function handleSelectCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  if (command.capability === 'select') {
    const entityId = `${entity.type}-${entity.objectId}`;
    connection.client.sendSelectCommand(entityId, String(command.value));
  }
}

async function handleFanCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  const options: Record<string, unknown> = {};

  if (command.capability === 'speed') {
    options.speedLevel = Number(command.value);
    options.state = true;
  } else if (command.capability === 'on_off') {
    options.state = Boolean(command.value);
  }

  const entityId = `${entity.type}-${entity.objectId}`;
  connection.client.sendFanCommand(entityId, options);
}

async function handleCoverCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  const options: Record<string, unknown> = {};

  if (command.capability === 'position') {
    options.position = Number(command.value) / 100; // Convert 0-100 to 0-1
  }

  const entityId = `${entity.type}-${entity.objectId}`;
  connection.client.sendCoverCommand(entityId, options);
}

async function handleClimateCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  const options: Record<string, unknown> = {};

  if (command.capability === 'temperature') {
    options.targetTemperature = Number(command.value);
  }

  const entityId = `${entity.type}-${entity.objectId}`;
  connection.client.sendClimateCommand(entityId, options);
}

async function handleLockCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  const state = String(command.value).toLowerCase();
  const entityId = `${entity.type}-${entity.objectId}`;

  if (state === 'lock') {
    connection.client.sendLockCommand(entityId, 'lock');
  } else if (state === 'unlock') {
    connection.client.sendLockCommand(entityId, 'unlock');
  } else if (state === 'open') {
    connection.client.sendLockCommand(entityId, 'open');
  }
}

/**
 * Invoke a command on an entity
 * Default export - primary command function
 */
export default async function invoke(
  entityId: string,
  command: DriverCommand,
): Promise<DriverResult> {
  const state = getDriverState();
  const deviceId = extractDeviceId(entityId);

  if (!deviceId) {
    return {
      error: `Invalid entity ID: ${entityId}`,
      ok: false,
    };
  }

  const connection = state.connections.get(deviceId);

  if (!connection || !connection.connected) {
    return {
      error: `No active connection for device ${deviceId}`,
      ok: false,
    };
  }

  const entity = connection.entities.get(entityId);
  if (!entity) {
    return {
      error: `Entity ${entityId} not found`,
      ok: false,
    };
  }

  try {
    // Route command to appropriate handler based on entity type
    switch (entity.type) {
      case 'switch':
        await handleSwitchCommand(connection, entity, command);
        break;
      case 'light':
        await handleLightCommand(connection, entity, command);
        break;
      case 'button':
        await handleButtonCommand(connection, entity, command);
        break;
      case 'number':
        await handleNumberCommand(connection, entity, command);
        break;
      case 'select':
        await handleSelectCommand(connection, entity, command);
        break;
      case 'fan':
        await handleFanCommand(connection, entity, command);
        break;
      case 'cover':
        await handleCoverCommand(connection, entity, command);
        break;
      case 'climate':
        await handleClimateCommand(connection, entity, command);
        break;
      case 'lock':
        await handleLockCommand(connection, entity, command);
        break;
      default:
        return {
          error: `Unsupported entity type: ${entity.type}`,
          ok: false,
        };
    }

    return { ok: true };
  } catch (error) {
    log(`Error invoking command on ${entityId}:`, error);
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
}

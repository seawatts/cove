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
    // ESPHome clients typically use switchCommand(key, state) with numeric key
    const client = connection.client as {
      switchCommand?: (key: number, state: boolean) => Promise<void> | void;
      sendSwitchCommand?: (key: number, state: boolean) => Promise<void> | void;
    };
    if (client.switchCommand) {
      await client.switchCommand(entity.key, state);
    } else if (client.sendSwitchCommand) {
      await client.sendSwitchCommand(entity.key, state);
    } else {
      log(
        `No switchCommand method found on client for entity ${entity.entityId}`,
      );
    }
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
    // ESPHome expects red, green, blue as 0-1 values
    options.red = (color.r ?? 0) / 255;
    options.green = (color.g ?? 0) / 255;
    options.blue = (color.b ?? 0) / 255;
    options.state = true;
  }

  // ESPHome clients typically use lightCommand(key, command) with numeric key
  const client = connection.client as {
    lightCommand?: (
      key: number,
      command: Record<string, unknown>,
    ) => Promise<void> | void;
    sendLightCommand?: (
      key: number,
      command: Record<string, unknown>,
    ) => Promise<void> | void;
  };
  if (client.lightCommand) {
    await client.lightCommand(entity.key, options);
  } else if (client.sendLightCommand) {
    await client.sendLightCommand(entity.key, options);
  } else {
    log(`No lightCommand method found on client for entity ${entity.entityId}`);
  }
}

async function handleButtonCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  _command: DriverCommand,
): Promise<void> {
  const client = connection.client as {
    buttonCommand?: (key: number) => Promise<void> | void;
    sendButtonCommand?: (key: number) => Promise<void> | void;
  };
  if (client.buttonCommand) {
    await client.buttonCommand(entity.key);
  } else if (client.sendButtonCommand) {
    await client.sendButtonCommand(entity.key);
  } else {
    log(
      `No buttonCommand method found on client for entity ${entity.entityId}`,
    );
  }
}

async function handleNumberCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  if (command.capability === 'numeric') {
    const client = connection.client as {
      numberCommand?: (key: number, value: number) => Promise<void> | void;
      sendNumberCommand?: (key: number, value: number) => Promise<void> | void;
    };
    if (client.numberCommand) {
      await client.numberCommand(entity.key, Number(command.value));
    } else if (client.sendNumberCommand) {
      await client.sendNumberCommand(entity.key, Number(command.value));
    } else {
      log(
        `No numberCommand method found on client for entity ${entity.entityId}`,
      );
    }
  }
}

async function handleSelectCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  if (command.capability === 'select') {
    const client = connection.client as {
      selectCommand?: (key: number, value: string) => Promise<void> | void;
      sendSelectCommand?: (key: number, value: string) => Promise<void> | void;
    };
    if (client.selectCommand) {
      await client.selectCommand(entity.key, String(command.value));
    } else if (client.sendSelectCommand) {
      await client.sendSelectCommand(entity.key, String(command.value));
    } else {
      log(
        `No selectCommand method found on client for entity ${entity.entityId}`,
      );
    }
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

  const client = connection.client as {
    fanCommand?: (
      key: number,
      command: Record<string, unknown>,
    ) => Promise<void> | void;
    sendFanCommand?: (
      key: number,
      command: Record<string, unknown>,
    ) => Promise<void> | void;
  };
  if (client.fanCommand) {
    await client.fanCommand(entity.key, options);
  } else if (client.sendFanCommand) {
    await client.sendFanCommand(entity.key, options);
  } else {
    log(`No fanCommand method found on client for entity ${entity.entityId}`);
  }
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

  const client = connection.client as {
    coverCommand?: (
      key: number,
      command: Record<string, unknown>,
    ) => Promise<void> | void;
    sendCoverCommand?: (
      key: number,
      command: Record<string, unknown>,
    ) => Promise<void> | void;
  };
  if (client.coverCommand) {
    await client.coverCommand(entity.key, options);
  } else if (client.sendCoverCommand) {
    await client.sendCoverCommand(entity.key, options);
  } else {
    log(`No coverCommand method found on client for entity ${entity.entityId}`);
  }
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

  const client = connection.client as {
    climateCommand?: (
      key: number,
      command: Record<string, unknown>,
    ) => Promise<void> | void;
    sendClimateCommand?: (
      key: number,
      command: Record<string, unknown>,
    ) => Promise<void> | void;
  };
  if (client.climateCommand) {
    await client.climateCommand(entity.key, options);
  } else if (client.sendClimateCommand) {
    await client.sendClimateCommand(entity.key, options);
  } else {
    log(
      `No climateCommand method found on client for entity ${entity.entityId}`,
    );
  }
}

async function handleLockCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  const state = String(command.value).toLowerCase();
  const client = connection.client as {
    lockCommand?: (key: number, action: string) => Promise<void> | void;
    sendLockCommand?: (key: number, action: string) => Promise<void> | void;
  };

  if (client.lockCommand) {
    if (state === 'lock') {
      await client.lockCommand(entity.key, 'lock');
    } else if (state === 'unlock') {
      await client.lockCommand(entity.key, 'unlock');
    } else if (state === 'open') {
      await client.lockCommand(entity.key, 'open');
    }
  } else if (client.sendLockCommand) {
    if (state === 'lock') {
      await client.sendLockCommand(entity.key, 'lock');
    } else if (state === 'unlock') {
      await client.sendLockCommand(entity.key, 'unlock');
    } else if (state === 'open') {
      await client.sendLockCommand(entity.key, 'open');
    }
  } else {
    log(`No lockCommand method found on client for entity ${entity.entityId}`);
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

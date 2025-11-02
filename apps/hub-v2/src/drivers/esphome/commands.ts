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
    // ESPHome client expects entity ID in format: "switch-objectId"
    const clientEntityId = `${entity.type}-${entity.objectId}`.toLowerCase();

    const client = connection.client as {
      sendSwitchCommand?: (id: string, state: boolean) => Promise<void> | void;
    };

    if (client.sendSwitchCommand) {
      await client.sendSwitchCommand(clientEntityId, state);
    } else {
      log(
        `No sendSwitchCommand method found on client for entity ${entity.entityId}`,
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

  // ESPHome client expects entity ID in format: "light-objectId"
  // Our entity.entityId is "deviceId:objectId", so we need to construct the client ID
  const clientEntityId = `${entity.type}-${entity.objectId}`.toLowerCase();

  const client = connection.client as {
    sendLightCommand?: (
      id: string,
      options: Record<string, unknown>,
    ) => Promise<void> | void;
  };

  if (client.sendLightCommand) {
    await client.sendLightCommand(clientEntityId, options);
  } else {
    log(
      `No sendLightCommand method found on client for entity ${entity.entityId}`,
    );
  }
}

async function handleButtonCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  _command: DriverCommand,
): Promise<void> {
  // ESPHome client expects entity ID in format: "button-objectId"
  const clientEntityId = `${entity.type}-${entity.objectId}`.toLowerCase();

  const client = connection.client as {
    sendButtonCommand?: (id: string) => Promise<void> | void;
  };

  if (client.sendButtonCommand) {
    await client.sendButtonCommand(clientEntityId);
  } else {
    log(
      `No sendButtonCommand method found on client for entity ${entity.entityId}`,
    );
  }
}

async function handleNumberCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  if (command.capability === 'numeric') {
    // ESPHome client expects entity ID in format: "number-objectId"
    const clientEntityId = `${entity.type}-${entity.objectId}`.toLowerCase();

    const client = connection.client as {
      sendNumberCommand?: (id: string, value: number) => Promise<void> | void;
    };

    if (client.sendNumberCommand) {
      await client.sendNumberCommand(clientEntityId, Number(command.value));
    } else {
      log(
        `No sendNumberCommand method found on client for entity ${entity.entityId}`,
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
    // ESPHome client expects entity ID in format: "select-objectId"
    const clientEntityId = `${entity.type}-${entity.objectId}`.toLowerCase();

    const client = connection.client as {
      sendSelectCommand?: (id: string, value: string) => Promise<void> | void;
    };

    if (client.sendSelectCommand) {
      await client.sendSelectCommand(clientEntityId, String(command.value));
    } else {
      log(
        `No sendSelectCommand method found on client for entity ${entity.entityId}`,
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

  // ESPHome client expects entity ID in format: "fan-objectId"
  const clientEntityId = `${entity.type}-${entity.objectId}`.toLowerCase();

  const client = connection.client as {
    sendFanCommand?: (
      id: string,
      options: Record<string, unknown>,
    ) => Promise<void> | void;
  };

  if (client.sendFanCommand) {
    await client.sendFanCommand(clientEntityId, options);
  } else {
    log(
      `No sendFanCommand method found on client for entity ${entity.entityId}`,
    );
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

  // ESPHome client expects entity ID in format: "cover-objectId"
  const clientEntityId = `${entity.type}-${entity.objectId}`.toLowerCase();

  const client = connection.client as {
    sendCoverCommand?: (
      id: string,
      options: Record<string, unknown>,
    ) => Promise<void> | void;
  };

  if (client.sendCoverCommand) {
    await client.sendCoverCommand(clientEntityId, options);
  } else {
    log(
      `No sendCoverCommand method found on client for entity ${entity.entityId}`,
    );
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

  // ESPHome client expects entity ID in format: "climate-objectId"
  const clientEntityId = `${entity.type}-${entity.objectId}`.toLowerCase();

  const client = connection.client as {
    sendClimateCommand?: (
      id: string,
      options: Record<string, unknown>,
    ) => Promise<void> | void;
  };

  if (client.sendClimateCommand) {
    await client.sendClimateCommand(clientEntityId, options);
  } else {
    log(
      `No sendClimateCommand method found on client for entity ${entity.entityId}`,
    );
  }
}

async function handleLockCommand(
  connection: ESPHomeConnection,
  entity: ESPHomeEntity,
  command: DriverCommand,
): Promise<void> {
  const state = String(command.value).toLowerCase();
  // ESPHome client expects entity ID in format: "lock-objectId"
  const clientEntityId = `${entity.type}-${entity.objectId}`.toLowerCase();

  const client = connection.client as {
    sendLockCommand?: (id: string, action: string) => Promise<void> | void;
  };

  if (client.sendLockCommand) {
    if (state === 'lock') {
      await client.sendLockCommand(clientEntityId, 'lock');
    } else if (state === 'unlock') {
      await client.sendLockCommand(clientEntityId, 'unlock');
    } else if (state === 'open') {
      await client.sendLockCommand(clientEntityId, 'open');
    }
  } else {
    log(
      `No sendLockCommand method found on client for entity ${entity.entityId}`,
    );
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

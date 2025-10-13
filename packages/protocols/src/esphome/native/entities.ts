/**
 * Entity parsers for all ESPHome entity types
 * Based on aioesphomeapi entity parsing
 */

import { decodeField } from './protocol';
import type {
  ButtonEntity,
  LightEntity,
  NumberEntity,
  SwitchEntity,
  TextSensorEntity,
} from './types';

/**
 * Parse ListEntitiesSwitchResponse
 */
export function parseSwitchEntity(data: Buffer): Partial<SwitchEntity> {
  const result: Partial<SwitchEntity> & { type: 'switch' } = { type: 'switch' };
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        result.objectId = (field.value as Buffer).toString('utf8');
        break;
      case 2:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 3:
        result.name = (field.value as Buffer).toString('utf8');
        break;
      case 4:
        result.uniqueId = (field.value as Buffer).toString('utf8');
        break;
      case 5:
        result.icon = (field.value as Buffer).toString('utf8');
        break;
      case 6:
        result.assumedState = (field.value as number) !== 0;
        break;
      case 7:
        result.disabled = (field.value as number) !== 0;
        break;
      case 9:
        result.deviceClass = (field.value as Buffer).toString('utf8');
        break;
    }

    offset += field.bytesRead;
  }

  return result;
}

/**
 * Parse ListEntitiesLightResponse
 */
export function parseLightEntity(data: Buffer): Partial<LightEntity> {
  const result: Partial<LightEntity> & { type: 'light' } = { type: 'light' };
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        result.objectId = (field.value as Buffer).toString('utf8');
        break;
      case 2:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 3:
        result.name = (field.value as Buffer).toString('utf8');
        break;
      case 4:
        result.uniqueId = (field.value as Buffer).toString('utf8');
        break;
      case 12:
        result.supportsBrightness = (field.value as number) !== 0;
        break;
      case 20:
        // Supported color modes (repeated field)
        if (!result.supportedColorModes) result.supportedColorModes = [];
        result.supportedColorModes.push(field.value as number);
        break;
      case 19:
        // Effects list
        if (!result.effects) result.effects = [];
        result.effects.push((field.value as Buffer).toString('utf8'));
        break;
    }

    offset += field.bytesRead;
  }

  return result;
}

/**
 * Parse ListEntitiesButtonResponse
 */
export function parseButtonEntity(data: Buffer): Partial<ButtonEntity> {
  const result: Partial<ButtonEntity> & { type: 'button' } = { type: 'button' };
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        result.objectId = (field.value as Buffer).toString('utf8');
        break;
      case 2:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 3:
        result.name = (field.value as Buffer).toString('utf8');
        break;
      case 4:
        result.uniqueId = (field.value as Buffer).toString('utf8');
        break;
      case 5:
        result.icon = (field.value as Buffer).toString('utf8');
        break;
      case 8:
        result.deviceClass = (field.value as Buffer).toString('utf8');
        break;
    }

    offset += field.bytesRead;
  }

  return result;
}

/**
 * Parse ListEntitiesNumberResponse
 */
export function parseNumberEntity(data: Buffer): Partial<NumberEntity> {
  const result: Partial<NumberEntity> & { type: 'number' } = { type: 'number' };
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        result.objectId = (field.value as Buffer).toString('utf8');
        break;
      case 2:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 3:
        result.name = (field.value as Buffer).toString('utf8');
        break;
      case 4:
        result.uniqueId = (field.value as Buffer).toString('utf8');
        break;
      case 5:
        result.icon = (field.value as Buffer).toString('utf8');
        break;
      case 6:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.minValue = field.value.readFloatLE(0);
        }
        break;
      case 7:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.maxValue = field.value.readFloatLE(0);
        }
        break;
      case 8:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.step = field.value.readFloatLE(0);
        }
        break;
      case 11:
        result.unitOfMeasurement = (field.value as Buffer).toString('utf8');
        break;
      case 13:
        result.deviceClass = (field.value as Buffer).toString('utf8');
        break;
    }

    offset += field.bytesRead;
  }

  return result;
}

/**
 * Parse ListEntitiesTextSensorResponse
 */
export function parseTextSensorEntity(data: Buffer): Partial<TextSensorEntity> {
  const result: Partial<TextSensorEntity> & { type: 'text_sensor' } = {
    type: 'text_sensor',
  };
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        result.objectId = (field.value as Buffer).toString('utf8');
        break;
      case 2:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 3:
        result.name = (field.value as Buffer).toString('utf8');
        break;
      case 4:
        result.uniqueId = (field.value as Buffer).toString('utf8');
        break;
      case 5:
        result.icon = (field.value as Buffer).toString('utf8');
        break;
      case 7:
        result.deviceClass = (field.value as Buffer).toString('utf8');
        break;
    }

    offset += field.bytesRead;
  }

  return result;
}

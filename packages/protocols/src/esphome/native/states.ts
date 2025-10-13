/**
 * State parsers for all ESPHome entity types
 */

import { decodeField } from './protocol';
import type {
  BinarySensorState,
  LightState,
  NumberState,
  SwitchState,
  TextSensorState,
} from './types';

/**
 * Parse BinarySensorStateResponse
 */
export function parseBinarySensorState(data: Buffer): BinarySensorState {
  const result: Partial<BinarySensorState> = {};
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 2:
        result.state = (field.value as number) !== 0;
        break;
      case 3:
        result.missingState = (field.value as number) !== 0;
        break;
    }

    offset += field.bytesRead;
  }

  return result as BinarySensorState;
}

/**
 * Parse SwitchStateResponse
 */
export function parseSwitchState(data: Buffer): SwitchState {
  const result: Partial<SwitchState> = {};
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 2:
        result.state = (field.value as number) !== 0;
        break;
    }

    offset += field.bytesRead;
  }

  return result as SwitchState;
}

/**
 * Parse LightStateResponse
 */
export function parseLightState(data: Buffer): LightState {
  const result: Partial<LightState> = {};
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 2:
        result.state = (field.value as number) !== 0;
        break;
      case 3:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.brightness = field.value.readFloatLE(0);
        }
        break;
      case 11:
        result.colorMode = field.value as number;
        break;
      case 10:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.colorBrightness = field.value.readFloatLE(0);
        }
        break;
      case 4:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.red = field.value.readFloatLE(0);
        }
        break;
      case 5:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.green = field.value.readFloatLE(0);
        }
        break;
      case 6:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.blue = field.value.readFloatLE(0);
        }
        break;
      case 7:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.white = field.value.readFloatLE(0);
        }
        break;
      case 8:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.colorTemperature = field.value.readFloatLE(0);
        }
        break;
      case 9:
        result.effect = (field.value as Buffer).toString('utf8');
        break;
    }

    offset += field.bytesRead;
  }

  return result as LightState;
}

/**
 * Parse NumberStateResponse
 */
export function parseNumberState(data: Buffer): NumberState {
  const result: Partial<NumberState> = {};
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 2:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.state = field.value.readFloatLE(0);
        } else {
          result.state = field.value as number;
        }
        break;
      case 3:
        result.missingState = (field.value as number) !== 0;
        break;
    }

    offset += field.bytesRead;
  }

  return result as NumberState;
}

/**
 * Parse TextSensorStateResponse
 */
export function parseTextSensorState(data: Buffer): TextSensorState {
  const result: Partial<TextSensorState> = {};
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 2:
        result.state = (field.value as Buffer).toString('utf8');
        break;
      case 3:
        result.missingState = (field.value as number) !== 0;
        break;
    }

    offset += field.bytesRead;
  }

  return result as TextSensorState;
}

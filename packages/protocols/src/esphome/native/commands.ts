/**
 * Command builders for ESPHome entities
 * Based on aioesphomeapi command implementation
 */

import { encodeField } from './protocol';
import type {
  ButtonCommand,
  LightCommand,
  NumberCommand,
  SwitchCommand,
} from './types';

/**
 * Build SwitchCommandRequest
 * Message type: 33
 */
export function buildSwitchCommand(command: SwitchCommand): Buffer {
  return Buffer.concat([
    encodeField(1, command.key), // key (fixed32)
    encodeField(2, command.state), // state (bool)
  ]);
}

/**
 * Build LightCommandRequest
 * Message type: 32
 */
export function buildLightCommand(command: LightCommand): Buffer {
  const buffers: Buffer[] = [];

  // Key (required)
  buffers.push(encodeField(1, command.key));

  // State (optional)
  if (command.state !== undefined) {
    buffers.push(encodeField(2, true)); // has_state
    buffers.push(encodeField(3, command.state)); // state
  }

  // Brightness (optional)
  if (command.brightness !== undefined) {
    buffers.push(encodeField(4, true)); // has_brightness
    // TODO: Encode float properly
    buffers.push(encodeField(5, command.brightness)); // brightness (should be float)
  }

  // RGB (optional)
  if (
    command.red !== undefined &&
    command.green !== undefined &&
    command.blue !== undefined
  ) {
    buffers.push(encodeField(6, true)); // has_rgb
    // TODO: Encode floats for RGB
    buffers.push(encodeField(7, command.red));
    buffers.push(encodeField(8, command.green));
    buffers.push(encodeField(9, command.blue));
  }

  // Color temperature (optional)
  if (command.colorTemperature !== undefined) {
    buffers.push(encodeField(12, true)); // has_color_temperature
    // TODO: Encode float
    buffers.push(encodeField(13, command.colorTemperature));
  }

  // Transition length (optional)
  if (command.transitionLength !== undefined) {
    buffers.push(encodeField(14, true)); // has_transition_length
    buffers.push(encodeField(15, command.transitionLength));
  }

  // Effect (optional)
  if (command.effect !== undefined) {
    buffers.push(encodeField(18, true)); // has_effect
    buffers.push(encodeField(19, command.effect));
  }

  return Buffer.concat(buffers);
}

/**
 * Build ButtonCommandRequest
 * Message type: 62
 */
export function buildButtonCommand(command: ButtonCommand): Buffer {
  return encodeField(1, command.key); // key (fixed32)
}

/**
 * Build NumberCommandRequest
 * Message type: 47
 */
export function buildNumberCommand(command: NumberCommand): Buffer {
  return Buffer.concat([
    encodeField(1, command.key), // key
    // TODO: Encode float for state
    encodeField(2, command.state), // state (float)
  ]);
}

/**
 * Helper to encode fixed32 uint
 */
export function encodeFixed32(value: number): Buffer {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

/**
 * Helper to encode IEEE 754 float
 */
export function encodeFloat(value: number): Buffer {
  const buf = Buffer.allocUnsafe(4);
  buf.writeFloatLE(value, 0);
  return buf;
}

/**
 * Encode a fixed32 field (for keys and floats)
 */
export function encodeFixed32Field(
  fieldNumber: number,
  value: number,
  isFloat = false,
): Buffer {
  const key = (fieldNumber << 3) | 5; // Wire type 5 (fixed32)

  // TODO: Fix this - need to encode wire type 5 properly
  const data = isFloat ? encodeFloat(value) : encodeFixed32(value);

  return Buffer.concat([
    Buffer.from([key]), // Simple varint for small field numbers
    data,
  ]);
}

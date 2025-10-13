/**
 * ESPHome Native API Protocol
 * Message framing and encoding/decoding
 */

import type { MessageFrame, MessageType } from './types';

/**
 * Encode a varint (variable-length integer)
 */
export function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let n = value;

  while (n >= 0x80) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n & 0x7f);

  return Buffer.from(bytes);
}

/**
 * Decode a varint from a buffer
 * Returns [value, bytesRead]
 */
export function decodeVarint(buffer: Buffer, offset = 0): [number, number] {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset + bytesRead < buffer.length) {
    const byte = buffer[offset + bytesRead];
    if (byte === undefined) break;
    bytesRead++;

    value |= (byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      return [value, bytesRead];
    }

    shift += 7;
  }

  throw new Error('Incomplete varint');
}

/**
 * Encode a message field
 * ESPHome uses a simple protobuf-like encoding
 */
export function encodeField(
  fieldNumber: number,
  value: string | number | boolean | Buffer,
): Buffer {
  const buffers: Buffer[] = [];

  if (typeof value === 'string') {
    // String: field_key + length + data
    const key = (fieldNumber << 3) | 2; // Wire type 2 (length-delimited)
    buffers.push(encodeVarint(key));

    const data = Buffer.from(value, 'utf8');
    buffers.push(encodeVarint(data.length));
    buffers.push(data);
  } else if (typeof value === 'number') {
    // Number: field_key + varint
    const key = (fieldNumber << 3) | 0; // Wire type 0 (varint)
    buffers.push(encodeVarint(key));
    buffers.push(encodeVarint(value));
  } else if (typeof value === 'boolean') {
    // Boolean: field_key + varint(0|1)
    const key = (fieldNumber << 3) | 0;
    buffers.push(encodeVarint(key));
    buffers.push(encodeVarint(value ? 1 : 0));
  }

  return Buffer.concat(buffers);
}

/**
 * Decode a protobuf-like message field
 */
export function decodeField(
  buffer: Buffer,
  offset: number,
): {
  fieldNumber: number;
  wireType: number;
  value: string | number | boolean | Buffer | null;
  bytesRead: number;
} | null {
  if (offset >= buffer.length) {
    return null;
  }

  // Read field key (field_number << 3 | wire_type)
  const [key, keyBytes] = decodeVarint(buffer, offset);
  const currentOffset = offset + keyBytes;

  const fieldNumber = key >>> 3;
  const wireType = key & 0x7;

  let value: string | number | boolean | Buffer | null = null;
  let valueBytes = 0;

  switch (wireType) {
    case 0: // Varint
      {
        const [val, bytes] = decodeVarint(buffer, currentOffset);
        value = val;
        valueBytes = bytes;
      }
      break;

    case 2: // Length-delimited (string or bytes)
      {
        const [length, lengthBytes] = decodeVarint(buffer, currentOffset);
        const dataOffset = currentOffset + lengthBytes;
        value = buffer.subarray(dataOffset, dataOffset + length);
        valueBytes = lengthBytes + length;
      }
      break;

    case 5: // 32-bit (fixed32 - can be int or float, return raw buffer)
      // Return raw buffer so caller can decide how to decode
      value = buffer.subarray(currentOffset, currentOffset + 4);
      valueBytes = 4;
      break;

    default:
      throw new Error(`Unsupported wire type: ${wireType}`);
  }

  return {
    bytesRead: keyBytes + valueBytes,
    fieldNumber,
    value,
    wireType,
  };
}

/**
 * Frame a message for sending
 * Format: [0x00][length_varint][type_varint][payload]
 */
export function frameMessage(type: MessageType, payload: Buffer): Buffer {
  const typeVarint = encodeVarint(type);
  const lengthVarint = encodeVarint(payload.length);

  return Buffer.concat([
    Buffer.from([0x00]), // Preamble
    lengthVarint,
    typeVarint,
    payload,
  ]);
}

/**
 * Parse a message frame from a buffer
 * Returns the frame or null if incomplete
 */
export function parseFrame(buffer: Buffer): {
  frame: MessageFrame;
  bytesConsumed: number;
} | null {
  if (buffer.length < 3) {
    return null; // Need at least preamble + 2 varints
  }

  let offset = 0;

  // Check preamble
  if (buffer[offset] !== 0x00) {
    throw new Error(`Invalid preamble: ${buffer[offset]}`);
  }
  offset++;

  // Read length
  const [length, lengthBytes] = decodeVarint(buffer, offset);
  offset += lengthBytes;

  // Read type
  const [type, typeBytes] = decodeVarint(buffer, offset);
  offset += typeBytes;

  // Check if we have the full payload
  const totalSize = offset + length;
  if (buffer.length < totalSize) {
    return null; // Incomplete frame
  }

  // Extract payload
  const data = buffer.subarray(offset, offset + length);

  return {
    bytesConsumed: totalSize,
    frame: { data, type },
  };
}

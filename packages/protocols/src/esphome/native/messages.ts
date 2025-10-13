/**
 * ESPHome message builders and parsers
 */

import { decodeField, encodeField } from './protocol';
import type {
  BinarySensorEntity,
  DeviceInfo,
  SensorEntity,
  SensorState,
} from './types';

/**
 * Build HelloRequest message
 */
export function buildHelloRequest(clientInfo: string): Buffer {
  return Buffer.concat([
    encodeField(1, clientInfo), // client_info
    encodeField(2, 1), // api_version_major
    encodeField(3, 10), // api_version_minor (1.10)
  ]);
}

/**
 * Parse HelloResponse
 */
export function parseHelloResponse(data: Buffer): {
  apiVersionMajor: number;
  apiVersionMinor: number;
  serverInfo: string;
  name: string;
} {
  const result: {
    apiVersionMajor?: number;
    apiVersionMinor?: number;
    serverInfo?: string;
    name?: string;
  } = {};
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        result.apiVersionMajor = field.value as number;
        break;
      case 2:
        result.apiVersionMinor = field.value as number;
        break;
      case 3:
        result.serverInfo = (field.value as Buffer).toString('utf8');
        break;
      case 4:
        result.name = (field.value as Buffer).toString('utf8');
        break;
    }

    offset += field.bytesRead;
  }

  return {
    apiVersionMajor: result.apiVersionMajor || 0,
    apiVersionMinor: result.apiVersionMinor || 0,
    name: result.name || '',
    serverInfo: result.serverInfo || '',
  };
}

/**
 * Build ConnectRequest
 */
export function buildConnectRequest(password: string): Buffer {
  return encodeField(1, password); // password field
}

/**
 * Parse ConnectResponse
 */
export function parseConnectResponse(data: Buffer): {
  invalidPassword: boolean;
} {
  if (data.length === 0) {
    return { invalidPassword: false };
  }

  const field = decodeField(data, 0);
  return {
    invalidPassword:
      field?.fieldNumber === 1 ? (field.value as number) !== 0 : false,
  };
}

/**
 * Build DeviceInfoRequest (empty message)
 */
export function buildDeviceInfoRequest(): Buffer {
  return Buffer.alloc(0);
}

/**
 * Parse DeviceInfoResponse
 */
export function parseDeviceInfoResponse(data: Buffer): Partial<DeviceInfo> {
  const result: Partial<DeviceInfo> = {};
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        result.usesPassword = (field.value as number) !== 0;
        break;
      case 2:
        result.name = (field.value as Buffer).toString('utf8');
        break;
      case 3:
        result.macAddress = (field.value as Buffer).toString('utf8');
        break;
      case 4:
        result.esphomeVersion = (field.value as Buffer).toString('utf8');
        break;
      case 5:
        result.compilationTime = (field.value as Buffer).toString('utf8');
        break;
      case 6:
        result.model = (field.value as Buffer).toString('utf8');
        break;
      case 7:
        result.hasDeepSleep = (field.value as number) !== 0;
        break;
      case 8:
        result.projectName = (field.value as Buffer).toString('utf8');
        break;
      case 9:
        result.projectVersion = (field.value as Buffer).toString('utf8');
        break;
      case 10:
        result.webserverPort = field.value as number;
        break;
    }

    offset += field.bytesRead;
  }

  return result;
}

/**
 * Build ListEntitiesRequest (empty)
 */
export function buildListEntitiesRequest(): Buffer {
  return Buffer.alloc(0);
}

/**
 * Parse ListEntitiesSensorResponse
 */
export function parseSensorEntity(data: Buffer): Partial<SensorEntity> {
  const result: Partial<SensorEntity> & { type: 'sensor' } = { type: 'sensor' };
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        result.objectId = (field.value as Buffer).toString('utf8');
        break;
      case 2:
        // Key is fixed32 uint
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
        result.unitOfMeasurement = (field.value as Buffer).toString('utf8');
        break;
      case 7:
        result.accuracyDecimals = field.value as number;
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
 * Parse BinarySensorEntity
 */
export function parseBinarySensorEntity(
  data: Buffer,
): Partial<BinarySensorEntity> {
  const result: Partial<BinarySensorEntity> & { type: 'binary_sensor' } = {
    type: 'binary_sensor',
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
        result.key = field.value as number;
        break;
      case 3:
        result.name = (field.value as Buffer).toString('utf8');
        break;
      case 4:
        result.uniqueId = (field.value as Buffer).toString('utf8');
        break;
      case 5:
        result.deviceClass = (field.value as Buffer).toString('utf8');
        break;
    }

    offset += field.bytesRead;
  }

  return result;
}

/**
 * Build SubscribeStatesRequest (empty)
 */
export function buildSubscribeStatesRequest(): Buffer {
  return Buffer.alloc(0);
}

/**
 * Parse SensorStateResponse
 */
export function parseSensorState(data: Buffer): SensorState {
  const result: Partial<SensorState> = {};
  let offset = 0;

  while (offset < data.length) {
    const field = decodeField(data, offset);
    if (!field) break;

    switch (field.fieldNumber) {
      case 1:
        // Key is fixed32 uint
        if (field.wireType === 5 && field.value instanceof Buffer) {
          result.key = field.value.readUInt32LE(0);
        } else {
          result.key = field.value as number;
        }
        break;
      case 2:
        // State is fixed32 float
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

  return {
    key: result.key || 0,
    missingState: result.missingState || false,
    state: result.state || 0,
  };
}

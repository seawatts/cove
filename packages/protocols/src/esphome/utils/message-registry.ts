/**
 * ESPHome Message Registry
 * Complete mapping of message IDs to protobuf schemas for type-safe parsing
 */

import type { DescMessage } from '@bufbuild/protobuf';
import {
  AlarmControlPanelCommandRequestSchema,
  AlarmControlPanelStateResponseSchema,
  AuthenticationRequestSchema,
  AuthenticationResponseSchema,
  BinarySensorStateResponseSchema,
  ButtonCommandRequestSchema,
  CameraImageRequestSchema,
  CameraImageResponseSchema,
  ClimateCommandRequestSchema,
  ClimateStateResponseSchema,
  // Commands (30-33)
  CoverCommandRequestSchema,
  CoverStateResponseSchema,
  DateCommandRequestSchema,
  DateStateResponseSchema,
  DateTimeCommandRequestSchema,
  DateTimeStateResponseSchema,
  // Device Info (9-10)
  DeviceInfoRequestSchema,
  DeviceInfoResponseSchema,
  DisconnectRequestSchema,
  DisconnectResponseSchema,
  EventResponseSchema,
  FanCommandRequestSchema,
  FanStateResponseSchema,
  // Connection Messages (1-8)
  HelloRequestSchema,
  HelloResponseSchema,
  LightCommandRequestSchema,
  LightStateResponseSchema,
  ListEntitiesAlarmControlPanelResponseSchema,
  ListEntitiesBinarySensorResponseSchema,
  // Button Entity (61-62)
  ListEntitiesButtonResponseSchema,
  // Additional entities (Camera, Climate, Lock, etc.)
  ListEntitiesCameraResponseSchema,
  ListEntitiesClimateResponseSchema,
  ListEntitiesCoverResponseSchema,
  ListEntitiesDateResponseSchema,
  ListEntitiesDateTimeResponseSchema,
  ListEntitiesDoneResponseSchema,
  ListEntitiesEventResponseSchema,
  ListEntitiesFanResponseSchema,
  ListEntitiesLightResponseSchema,
  ListEntitiesLockResponseSchema,
  // Number Entity (46-48)
  ListEntitiesNumberResponseSchema,
  // Entity Discovery (11-19)
  ListEntitiesRequestSchema,
  ListEntitiesSelectResponseSchema,
  ListEntitiesSensorResponseSchema,
  ListEntitiesSirenResponseSchema,
  ListEntitiesSwitchResponseSchema,
  ListEntitiesTextResponseSchema,
  ListEntitiesTextSensorResponseSchema,
  ListEntitiesTimeResponseSchema,
  ListEntitiesUpdateResponseSchema,
  ListEntitiesValveResponseSchema,
  LockCommandRequestSchema,
  LockStateResponseSchema,
  NumberCommandRequestSchema,
  NumberStateResponseSchema,
  PingRequestSchema,
  PingResponseSchema,
  SelectCommandRequestSchema,
  SelectStateResponseSchema,
  SensorStateResponseSchema,
  SirenCommandRequestSchema,
  SirenStateResponseSchema,
  // Logs (28-29)
  SubscribeLogsRequestSchema,
  SubscribeLogsResponseSchema,
  // State Subscriptions (20-27)
  SubscribeStatesRequestSchema,
  SwitchCommandRequestSchema,
  SwitchStateResponseSchema,
  TextCommandRequestSchema,
  TextSensorStateResponseSchema,
  TextStateResponseSchema,
  TimeCommandRequestSchema,
  TimeStateResponseSchema,
  UpdateCommandRequestSchema,
  UpdateStateResponseSchema,
  ValveCommandRequestSchema,
  ValveStateResponseSchema,
} from '../protoc/api_pb';

export interface MessageRegistryEntry {
  id: number;
  name: string;
  schema: DescMessage;
  direction: 'request' | 'response' | 'both';
}

/**
 * Complete registry mapping ESPHome protocol message IDs to protobuf schemas
 * Based on ESPHome API specification: https://esphome.io/components/api.html
 */
export const MESSAGE_REGISTRY = new Map<number, MessageRegistryEntry>([
  // Connection handshake (1-8)
  [
    1,
    {
      direction: 'request',
      id: 1,
      name: 'HelloRequest',
      schema: HelloRequestSchema,
    },
  ],
  [
    2,
    {
      direction: 'response',
      id: 2,
      name: 'HelloResponse',
      schema: HelloResponseSchema,
    },
  ],
  [
    3,
    {
      direction: 'request',
      id: 3,
      name: 'AuthenticationRequest',
      schema: AuthenticationRequestSchema,
    },
  ],
  [
    4,
    {
      direction: 'response',
      id: 4,
      name: 'AuthenticationResponse',
      schema: AuthenticationResponseSchema,
    },
  ],
  [
    5,
    {
      direction: 'both',
      id: 5,
      name: 'DisconnectRequest',
      schema: DisconnectRequestSchema,
    },
  ],
  [
    6,
    {
      direction: 'both',
      id: 6,
      name: 'DisconnectResponse',
      schema: DisconnectResponseSchema,
    },
  ],
  [
    7,
    {
      direction: 'request',
      id: 7,
      name: 'PingRequest',
      schema: PingRequestSchema,
    },
  ],
  [
    8,
    {
      direction: 'response',
      id: 8,
      name: 'PingResponse',
      schema: PingResponseSchema,
    },
  ],

  // Device info (9-10)
  [
    9,
    {
      direction: 'request',
      id: 9,
      name: 'DeviceInfoRequest',
      schema: DeviceInfoRequestSchema,
    },
  ],
  [
    10,
    {
      direction: 'response',
      id: 10,
      name: 'DeviceInfoResponse',
      schema: DeviceInfoResponseSchema,
    },
  ],

  // Entity discovery (11-19)
  [
    11,
    {
      direction: 'request',
      id: 11,
      name: 'ListEntitiesRequest',
      schema: ListEntitiesRequestSchema,
    },
  ],
  [
    12,
    {
      direction: 'response',
      id: 12,
      name: 'ListEntitiesBinarySensorResponse',
      schema: ListEntitiesBinarySensorResponseSchema,
    },
  ],
  [
    13,
    {
      direction: 'response',
      id: 13,
      name: 'ListEntitiesCoverResponse',
      schema: ListEntitiesCoverResponseSchema,
    },
  ],
  [
    14,
    {
      direction: 'response',
      id: 14,
      name: 'ListEntitiesFanResponse',
      schema: ListEntitiesFanResponseSchema,
    },
  ],
  [
    15,
    {
      direction: 'response',
      id: 15,
      name: 'ListEntitiesLightResponse',
      schema: ListEntitiesLightResponseSchema,
    },
  ],
  [
    16,
    {
      direction: 'response',
      id: 16,
      name: 'ListEntitiesSensorResponse',
      schema: ListEntitiesSensorResponseSchema,
    },
  ],
  [
    17,
    {
      direction: 'response',
      id: 17,
      name: 'ListEntitiesSwitchResponse',
      schema: ListEntitiesSwitchResponseSchema,
    },
  ],
  [
    18,
    {
      direction: 'response',
      id: 18,
      name: 'ListEntitiesTextSensorResponse',
      schema: ListEntitiesTextSensorResponseSchema,
    },
  ],
  [
    19,
    {
      direction: 'response',
      id: 19,
      name: 'ListEntitiesDoneResponse',
      schema: ListEntitiesDoneResponseSchema,
    },
  ],

  // State updates (20-27)
  [
    20,
    {
      direction: 'request',
      id: 20,
      name: 'SubscribeStatesRequest',
      schema: SubscribeStatesRequestSchema,
    },
  ],
  [
    21,
    {
      direction: 'response',
      id: 21,
      name: 'BinarySensorStateResponse',
      schema: BinarySensorStateResponseSchema,
    },
  ],
  [
    22,
    {
      direction: 'response',
      id: 22,
      name: 'CoverStateResponse',
      schema: CoverStateResponseSchema,
    },
  ],
  [
    23,
    {
      direction: 'response',
      id: 23,
      name: 'FanStateResponse',
      schema: FanStateResponseSchema,
    },
  ],
  [
    24,
    {
      direction: 'response',
      id: 24,
      name: 'LightStateResponse',
      schema: LightStateResponseSchema,
    },
  ],
  [
    25,
    {
      direction: 'response',
      id: 25,
      name: 'SensorStateResponse',
      schema: SensorStateResponseSchema,
    },
  ],
  [
    26,
    {
      direction: 'response',
      id: 26,
      name: 'SwitchStateResponse',
      schema: SwitchStateResponseSchema,
    },
  ],
  [
    27,
    {
      direction: 'response',
      id: 27,
      name: 'TextSensorStateResponse',
      schema: TextSensorStateResponseSchema,
    },
  ],

  // Logs (28-29)
  [
    28,
    {
      direction: 'request',
      id: 28,
      name: 'SubscribeLogsRequest',
      schema: SubscribeLogsRequestSchema,
    },
  ],
  [
    29,
    {
      direction: 'response',
      id: 29,
      name: 'SubscribeLogsResponse',
      schema: SubscribeLogsResponseSchema,
    },
  ],

  // Commands (30-33)
  [
    30,
    {
      direction: 'request',
      id: 30,
      name: 'CoverCommandRequest',
      schema: CoverCommandRequestSchema,
    },
  ],
  [
    31,
    {
      direction: 'request',
      id: 31,
      name: 'FanCommandRequest',
      schema: FanCommandRequestSchema,
    },
  ],
  [
    32,
    {
      direction: 'request',
      id: 32,
      name: 'LightCommandRequest',
      schema: LightCommandRequestSchema,
    },
  ],
  [
    33,
    {
      direction: 'request',
      id: 33,
      name: 'SwitchCommandRequest',
      schema: SwitchCommandRequestSchema,
    },
  ],

  // Number entity (46-48)
  [
    46,
    {
      direction: 'response',
      id: 46,
      name: 'ListEntitiesNumberResponse',
      schema: ListEntitiesNumberResponseSchema,
    },
  ],
  [
    47,
    {
      direction: 'request',
      id: 47,
      name: 'NumberCommandRequest',
      schema: NumberCommandRequestSchema,
    },
  ],
  [
    48,
    {
      direction: 'response',
      id: 48,
      name: 'NumberStateResponse',
      schema: NumberStateResponseSchema,
    },
  ],

  // Button entity (61-62)
  [
    61,
    {
      direction: 'response',
      id: 61,
      name: 'ListEntitiesButtonResponse',
      schema: ListEntitiesButtonResponseSchema,
    },
  ],
  [
    62,
    {
      direction: 'request',
      id: 62,
      name: 'ButtonCommandRequest',
      schema: ButtonCommandRequestSchema,
    },
  ],

  // Additional entity types (expand as needed)
  [
    34,
    {
      direction: 'response',
      id: 34,
      name: 'ListEntitiesCameraResponse',
      schema: ListEntitiesCameraResponseSchema,
    },
  ],
  [
    35,
    {
      direction: 'response',
      id: 35,
      name: 'CameraImageResponse',
      schema: CameraImageResponseSchema,
    },
  ],
  [
    36,
    {
      direction: 'request',
      id: 36,
      name: 'CameraImageRequest',
      schema: CameraImageRequestSchema,
    },
  ],

  // Number entity
  [
    49,
    {
      direction: 'response',
      id: 49,
      name: 'ListEntitiesNumberResponse',
      schema: ListEntitiesNumberResponseSchema,
    },
  ],
  [
    50,
    {
      direction: 'response',
      id: 50,
      name: 'NumberStateResponse',
      schema: NumberStateResponseSchema,
    },
  ],
  [
    51,
    {
      direction: 'request',
      id: 51,
      name: 'NumberCommandRequest',
      schema: NumberCommandRequestSchema,
    },
  ],

  // Siren entity
  [
    55,
    {
      direction: 'response',
      id: 55,
      name: 'ListEntitiesSirenResponse',
      schema: ListEntitiesSirenResponseSchema,
    },
  ],
  [
    56,
    {
      direction: 'response',
      id: 56,
      name: 'SirenStateResponse',
      schema: SirenStateResponseSchema,
    },
  ],
  [
    57,
    {
      direction: 'request',
      id: 57,
      name: 'SirenCommandRequest',
      schema: SirenCommandRequestSchema,
    },
  ],

  // Lock entity
  [
    58,
    {
      direction: 'response',
      id: 58,
      name: 'ListEntitiesLockResponse',
      schema: ListEntitiesLockResponseSchema,
    },
  ],
  [
    59,
    {
      direction: 'response',
      id: 59,
      name: 'LockStateResponse',
      schema: LockStateResponseSchema,
    },
  ],
  [
    60,
    {
      direction: 'request',
      id: 60,
      name: 'LockCommandRequest',
      schema: LockCommandRequestSchema,
    },
  ],

  // Button entity
  [
    61,
    {
      direction: 'response',
      id: 61,
      name: 'ListEntitiesButtonResponse',
      schema: ListEntitiesButtonResponseSchema,
    },
  ],
  [
    62,
    {
      direction: 'request',
      id: 62,
      name: 'ButtonCommandRequest',
      schema: ButtonCommandRequestSchema,
    },
  ],

  // Date entity
  [
    100,
    {
      direction: 'response',
      id: 100,
      name: 'ListEntitiesDateResponse',
      schema: ListEntitiesDateResponseSchema,
    },
  ],
  [
    101,
    {
      direction: 'response',
      id: 101,
      name: 'DateStateResponse',
      schema: DateStateResponseSchema,
    },
  ],
  [
    102,
    {
      direction: 'request',
      id: 102,
      name: 'DateCommandRequest',
      schema: DateCommandRequestSchema,
    },
  ],

  // Time entity
  [
    103,
    {
      direction: 'response',
      id: 103,
      name: 'ListEntitiesTimeResponse',
      schema: ListEntitiesTimeResponseSchema,
    },
  ],
  [
    104,
    {
      direction: 'response',
      id: 104,
      name: 'TimeStateResponse',
      schema: TimeStateResponseSchema,
    },
  ],
  [
    105,
    {
      direction: 'request',
      id: 105,
      name: 'TimeCommandRequest',
      schema: TimeCommandRequestSchema,
    },
  ],

  // Valve entity
  [
    109,
    {
      direction: 'response',
      id: 109,
      name: 'ListEntitiesValveResponse',
      schema: ListEntitiesValveResponseSchema,
    },
  ],
  [
    110,
    {
      direction: 'response',
      id: 110,
      name: 'ValveStateResponse',
      schema: ValveStateResponseSchema,
    },
  ],
  [
    111,
    {
      direction: 'request',
      id: 111,
      name: 'ValveCommandRequest',
      schema: ValveCommandRequestSchema,
    },
  ],

  // Climate entity
  [
    37,
    {
      direction: 'response',
      id: 37,
      name: 'ListEntitiesClimateResponse',
      schema: ListEntitiesClimateResponseSchema,
    },
  ],
  [
    38,
    {
      direction: 'response',
      id: 38,
      name: 'ClimateStateResponse',
      schema: ClimateStateResponseSchema,
    },
  ],
  [
    39,
    {
      direction: 'request',
      id: 39,
      name: 'ClimateCommandRequest',
      schema: ClimateCommandRequestSchema,
    },
  ],

  // Select entity
  [
    43,
    {
      direction: 'response',
      id: 43,
      name: 'ListEntitiesSelectResponse',
      schema: ListEntitiesSelectResponseSchema,
    },
  ],
  [
    44,
    {
      direction: 'response',
      id: 44,
      name: 'SelectStateResponse',
      schema: SelectStateResponseSchema,
    },
  ],
  [
    45,
    {
      direction: 'request',
      id: 45,
      name: 'SelectCommandRequest',
      schema: SelectCommandRequestSchema,
    },
  ],

  // DateTime entity
  [
    63,
    {
      direction: 'response',
      id: 63,
      name: 'ListEntitiesDateTimeResponse',
      schema: ListEntitiesDateTimeResponseSchema,
    },
  ],
  [
    64,
    {
      direction: 'response',
      id: 64,
      name: 'DateTimeStateResponse',
      schema: DateTimeStateResponseSchema,
    },
  ],
  [
    65,
    {
      direction: 'request',
      id: 65,
      name: 'DateTimeCommandRequest',
      schema: DateTimeCommandRequestSchema,
    },
  ],

  // Update entity
  [
    66,
    {
      direction: 'response',
      id: 66,
      name: 'ListEntitiesUpdateResponse',
      schema: ListEntitiesUpdateResponseSchema,
    },
  ],
  [
    67,
    {
      direction: 'response',
      id: 67,
      name: 'UpdateStateResponse',
      schema: UpdateStateResponseSchema,
    },
  ],
  [
    68,
    {
      direction: 'request',
      id: 68,
      name: 'UpdateCommandRequest',
      schema: UpdateCommandRequestSchema,
    },
  ],

  // Text entity
  [
    69,
    {
      direction: 'response',
      id: 69,
      name: 'ListEntitiesTextResponse',
      schema: ListEntitiesTextResponseSchema,
    },
  ],
  [
    70,
    {
      direction: 'response',
      id: 70,
      name: 'TextStateResponse',
      schema: TextStateResponseSchema,
    },
  ],
  [
    71,
    {
      direction: 'request',
      id: 71,
      name: 'TextCommandRequest',
      schema: TextCommandRequestSchema,
    },
  ],

  // Event entity
  [
    72,
    {
      direction: 'response',
      id: 72,
      name: 'ListEntitiesEventResponse',
      schema: ListEntitiesEventResponseSchema,
    },
  ],
  [
    73,
    {
      direction: 'response',
      id: 73,
      name: 'EventResponse',
      schema: EventResponseSchema,
    },
  ],

  // Alarm Control Panel entity
  [
    74,
    {
      direction: 'response',
      id: 74,
      name: 'ListEntitiesAlarmControlPanelResponse',
      schema: ListEntitiesAlarmControlPanelResponseSchema,
    },
  ],
  [
    75,
    {
      direction: 'response',
      id: 75,
      name: 'AlarmControlPanelStateResponse',
      schema: AlarmControlPanelStateResponseSchema,
    },
  ],
  [
    76,
    {
      direction: 'request',
      id: 76,
      name: 'AlarmControlPanelCommandRequest',
      schema: AlarmControlPanelCommandRequestSchema,
    },
  ],
]);

/**
 * Reverse lookup: Schema -> Message ID
 * Used for sending messages to find the correct ID
 */
export const SCHEMA_TO_ID = new Map<DescMessage, number>();
for (const [id, entry] of MESSAGE_REGISTRY) {
  SCHEMA_TO_ID.set(entry.schema, id);
}

/**
 * Get protobuf schema by message ID
 * Used for parsing incoming messages
 */
export function getSchemaById(id: number): DescMessage | undefined {
  return MESSAGE_REGISTRY.get(id)?.schema;
}

/**
 * Get message ID by protobuf schema
 * Used for sending messages
 */
export function getIdBySchema(schema: DescMessage): number | undefined {
  return SCHEMA_TO_ID.get(schema);
}

/**
 * Get message name by ID (for logging/debugging)
 */
export function getMessageNameById(id: number): string | undefined {
  return MESSAGE_REGISTRY.get(id)?.name;
}

/**
 * Get message registry entry by ID
 */
export function getRegistryEntry(id: number): MessageRegistryEntry | undefined {
  return MESSAGE_REGISTRY.get(id);
}

/**
 * Check if a message ID is valid
 */
export function isValidMessageId(id: number): boolean {
  return MESSAGE_REGISTRY.has(id);
}

/**
 * Get all registered message IDs (for debugging)
 */
export function getAllMessageIds(): number[] {
  return Array.from(MESSAGE_REGISTRY.keys()).sort((a, b) => a - b);
}

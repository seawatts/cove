import { subDays } from 'date-fns';
import { seed } from 'drizzle-seed';

import { db } from './client';
import {
  automation,
  automationTrace,
  automationVersion,
  device,
  entity,
  entityState,
  entityStateHistory,
  event,
  eventPayload,
  eventType,
  floor,
  home,
  mode,
  room,
  scene,
  sceneVersion,
  users,
} from './schema';

// Reset all tables (order matters due to foreign key constraints)
await db.delete(automationTrace);
await db.delete(automationVersion);
await db.delete(automation);
await db.delete(sceneVersion);
await db.delete(scene);
await db.delete(mode);
await db.delete(event);
await db.delete(eventPayload);
await db.delete(eventType);
await db.delete(entityStateHistory);
await db.delete(entityState);
await db.delete(entity);
await db.delete(device);
await db.delete(room);
await db.delete(floor);
await db.delete(users);
await db.delete(home);

const userId = 'user_1'
const homeId = 'home_1';
const floorId = 'floor_1';
const deviceId = 'device_1';
const entityId = 'entity_1';

await seed(db, {
  automation,
  automationTrace,
  automationVersion,
  device,
  entity,
  entityState,
  entityStateHistory,
  event,
  eventPayload,
  eventType,
  floor,
  home,
  mode,
  room,
  scene,
  sceneVersion,
  users,
}).refine((funcs) => ({
  automation: {
    columns: {
      createdBy: funcs.default({ defaultValue: userId }),
      enabled: funcs.boolean(),
      homeId: funcs.default({ defaultValue: homeId }),
      name: funcs.valuesFromArray({
        values: [
          'Auto Lights',
          'Security Alert',
          'Temperature Control',
          'Door Lock Timer',
          'Motion Detection',
        ],
      }),
    },
    count: 5,
  },
  automationTrace: {
    columns: {
      homeId: funcs.default({ defaultValue: homeId }),
      spans: funcs.default({
        defaultValue: [
          {
            duration: 100,
            id: 'span_1',
            operation: 'trigger',
            status: 'completed',
          },
        ],
      }),
      startedAt: funcs.date({
        maxDate: new Date(),
        minDate: subDays(new Date(), 1),
      }),
      status: funcs.valuesFromArray({
        values: ['running', 'completed', 'failed'],
      }),
      version: funcs.default({ defaultValue: 1 }),
    },
    count: 10,
  },
  automationVersion: {
    columns: {
      graph: funcs.default({
        defaultValue: {
          edges: [{ from: 'trigger', to: 'action' }],
          nodes: [
            {
              config: { entityId: entityId, state: 'on' },
              id: 'trigger',
              type: 'trigger',
            },
            {
              config: { entityId: entityId, state: 'off' },
              id: 'action',
              type: 'action',
            },
          ],
        },
      }),
      homeId: funcs.default({ defaultValue: homeId }),
      version: funcs.default({ defaultValue: 1 }),
    },
    count: 5,
  },
  device: {
    columns: {
      homeId: funcs.default({ defaultValue: homeId }),
      ipAddress: funcs.default({ defaultValue: '192.168.1.100' }),
      manufacturer: funcs.valuesFromArray({
        values: ['Philips', 'Eve', 'Schlage', 'Nest', 'Ring'],
      }),
      metadata: funcs.default({
        defaultValue: {
          capabilities: ['on/off', 'brightness', 'color'],
          firmware: '1.2.3',
        },
      }),
      model: funcs.valuesFromArray({
        values: ['Hue Dimmer', 'Motion', 'Encode', 'Learning', 'Doorbell'],
      }),
      name: funcs.valuesFromArray({
        values: [
          'Smart Light Switch',
          'Motion Sensor',
          'Door Lock',
          'Thermostat',
          'Security Camera',
        ],
      }),
    },
    count: 5,
  },
  entity: {
    columns: {
      deviceId: funcs.default({ defaultValue: deviceId }),
      key: funcs.valuesFromArray({
        values: [
          'light.living_room',
          'sensor.motion',
          'lock.front_door',
          'climate.thermostat',
          'camera.front_door',
        ],
      }),
      kind: funcs.valuesFromArray({
        values: ['light', 'sensor', 'lock', 'climate', 'camera'],
      }),
      traits: funcs.default({
        defaultValue: {
          brightness: true,
          color: true,
          on_off: true,
        },
      }),
    },
    count: 5,
  },
  entityState: {
    columns: {
      attrs: funcs.default({
        defaultValue: {
          brightness: 80,
          color: { b: 255, g: 255, r: 255 },
          temperature: 72,
        },
      }),
      entityId: funcs.default({ defaultValue: entityId }),
      state: funcs.valuesFromArray({
        values: ['on', 'off', 'locked', 'unlocked', 'home', 'away'],
      }),
    },
    count: 5,
  },
  entityStateHistory: {
    columns: {
      attrs: funcs.default({
        defaultValue: {
          brightness: 80,
          color: { b: 255, g: 255, r: 255 },
          temperature: 72,
        },
      }),
      entityId: funcs.default({ defaultValue: entityId }),
      homeId: funcs.default({ defaultValue: homeId }),
      state: funcs.valuesFromArray({
        values: ['on', 'off', 'locked', 'unlocked', 'home', 'away'],
      }),
      ts: funcs.date({
        maxDate: new Date(),
        minDate: subDays(new Date(), 7),
      }),
    },
    count: 50,
  },
  event: {
    columns: {
      contextId: funcs.default({ defaultValue: 'context_123' }),
      homeId: funcs.default({ defaultValue: homeId }),
      ts: funcs.date({
        maxDate: new Date(),
        minDate: subDays(new Date(), 7),
      }),
    },
    count: 20,
  },
  eventPayload: {
    columns: {
      body: funcs.default({
        defaultValue: {
          deviceId: deviceId,
          entityId: entityId,
          newState: 'on',
          oldState: 'off',
          timestamp: new Date().toISOString(),
        },
      }),
    },
    count: 20,
  },
  eventType: {
    columns: {
      eventType: funcs.valuesFromArray({
        values: [
          'device_discovered',
          'device_connected',
          'device_disconnected',
          'entity_state_changed',
          'automation_triggered',
          'scene_activated',
        ],
      }),
    },
    count: 6,
  },
  floor: {
    columns: {
      homeId: funcs.default({ defaultValue: homeId }),
      id: funcs.default({ defaultValue: floorId }),
      level: funcs.default({ defaultValue: 1 }),
      name: funcs.default({ defaultValue: 'First Floor' }),
    },
    count: 1,
  },
  home: {
    columns: {
      address: funcs.default({
        defaultValue: {
          city: 'San Francisco',
          state: 'CA',
          street: '123 Main St',
          zipCode: '94102',
        },
      }),
      id: funcs.default({ defaultValue: homeId }),
      name: funcs.default({ defaultValue: 'Smart Home' }),
      timezone: funcs.default({ defaultValue: 'America/Los_Angeles' }),
    },
    count: 1,
  },
  mode: {
    columns: {
      homeId: funcs.default({ defaultValue: homeId }),
      key: funcs.valuesFromArray({
        values: ['HOME', 'AWAY', 'SLEEP', 'VACATION', 'GUEST'],
      }),
      policy: funcs.default({
        defaultValue: {
          lights: 'auto',
          security: 'armed',
          temperature: 72,
        },
      }),
    },
    count: 5,
  },
  room: {
    columns: {
      floorId: funcs.default({ defaultValue: floorId }),
      homeId: funcs.default({ defaultValue: homeId }),
      name: funcs.valuesFromArray({
        values: ['Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 'Office'],
      }),
    },
    count: 5,
  },
  scene: {
    columns: {
      createdBy: funcs.default({ defaultValue: userId }),
      homeId: funcs.default({ defaultValue: homeId }),
      name: funcs.valuesFromArray({
        values: [
          'Movie Night',
          'Good Morning',
          'Good Night',
          'Party Mode',
          'Away Mode',
        ],
      }),
    },
    count: 5,
  },
  sceneVersion: {
    columns: {
      homeId: funcs.default({ defaultValue: homeId }),
      note: funcs.default({ defaultValue: 'Initial version' }),
      steps: funcs.default({
        defaultValue: [
          {
            attrs: { brightness: 50, color: { b: 0, g: 0, r: 255 } },
            entityId: entityId,
            state: 'on',
          },
        ],
      }),
      version: funcs.default({ defaultValue: 1 }),
    },
    count: 5,
  },
  users: {
    columns: {
      email: funcs.default({ defaultValue: 'chris.watts.t@gmail.com' }),
      firstName: funcs.default({ defaultValue: 'Chris' }),
      homeId: funcs.default({ defaultValue: homeId }),
      id: funcs.default({ defaultValue: userId }),
      lastName: funcs.default({ defaultValue: 'Watts' }),
      role: funcs.default({ defaultValue: 'OWNER' }),
    },
    count: 1,
  },
}));

process.exit(0);

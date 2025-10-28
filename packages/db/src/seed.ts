import { EntityKind } from '@cove/types';
import { subDays } from 'date-fns';
import { seed } from 'drizzle-seed';
import { db } from './client';
import {
  devices,
  entities,
  entityStateHistories,
  entityStates,
  events,
  homes,
  rooms,
  users,
} from './schema';

// Reset all tables (order matters due to foreign key constraints)
await db.delete(events);
await db.delete(entityStateHistories);
await db.delete(entityStates);
await db.delete(entities);
await db.delete(devices);
await db.delete(rooms);
await db.delete(users);
await db.delete(homes);

const userId = 'user_1';
const homeId = 'home_1';
const deviceId = 'device_1';
const entityId = 'entity_1';

await seed(db, {
  devices,
  entities,
  entityStateHistories,
  entityStates,
  events,
  homes,
  rooms,
  users,
}).refine((funcs) => ({
  devices: {
    columns: {
      available: funcs.boolean(),
      categories: funcs.default({
        defaultValue: ['smart-home'],
      }),
      homeId: funcs.default({ defaultValue: homeId }),
      ipAddress: funcs.default({ defaultValue: '192.168.1.100' }),
      macAddress: funcs.default({ defaultValue: '00:11:22:33:44:55' }),
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
      protocol: funcs.valuesFromArray({
        values: ['hue', 'esphome', 'matter', 'sonos'],
      }),
      type: funcs.valuesFromArray({
        values: ['light', 'sensor', 'lock', 'thermostat', 'camera'],
      }),
    },
    count: 5,
  },
  entities: {
    columns: {
      capabilities: funcs.default({
        defaultValue: [
          { type: 'on_off' },
          { type: 'brightness' },
          { type: 'rgb' },
        ],
      }),
      deviceClass: funcs.valuesFromArray({
        values: ['temperature', 'motion', 'door', 'climate', 'camera'],
      }),
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
        values: [
          EntityKind.Light,
          EntityKind.Sensor,
          EntityKind.Lock,
          EntityKind.Climate,
          EntityKind.Camera,
        ],
      }),
    },
    count: 5,
  },
  entityStateHistories: {
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
  entityStates: {
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
  events: {
    columns: {
      deviceId: funcs.default({ defaultValue: deviceId }),
      entityId: funcs.default({ defaultValue: entityId }),
      eventType: funcs.valuesFromArray({
        values: [
          'device.discovered',
          'device.connected',
          'device.disconnected',
          'state.changed',
        ],
      }),
      homeId: funcs.default({ defaultValue: homeId }),
      message: funcs.valuesFromArray({
        values: [
          'Device discovered successfully',
          'Device connected to network',
          'Device disconnected from network',
          'State changed to new value',
        ],
      }),
      metadata: funcs.default({
        defaultValue: {
          deviceId: deviceId,
          entityId: entityId,
          timestamp: new Date().toISOString(),
        },
      }),
      ts: funcs.date({
        maxDate: new Date(),
        minDate: subDays(new Date(), 7),
      }),
    },
    count: 20,
  },
  homes: {
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
  rooms: {
    columns: {
      floor: funcs.default({ defaultValue: 1 }),
      homeId: funcs.default({ defaultValue: homeId }),
      name: funcs.valuesFromArray({
        values: ['Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 'Office'],
      }),
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

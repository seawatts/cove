/**
 * Test helper functions for Hub V2 integration tests
 */

import { and, eq } from 'drizzle-orm';
import type { HubDaemon } from '../daemon';
import type { DatabaseClient } from '../db/client';
import * as schema from '../db/schema';
import { sleep, waitFor } from './setup';

/**
 * Database verification helpers
 */

export async function verifyHomeInDb(
  db: DatabaseClient,
  homeId: string,
): Promise<boolean> {
  try {
    const home = await db.query.homes.findFirst({
      where: eq(schema.homes.id, homeId),
    });
    return home !== undefined;
  } catch {
    return false;
  }
}

export async function verifyDeviceInDb(
  db: DatabaseClient,
  deviceId: string,
): Promise<boolean> {
  try {
    const device = await db.query.devices.findFirst({
      where: eq(schema.devices.id, deviceId),
    });
    return device !== undefined;
  } catch {
    return false;
  }
}

export async function verifyEntityInDb(
  db: DatabaseClient,
  entityId: string,
): Promise<boolean> {
  try {
    const entity = await db.query.entities.findFirst({
      where: eq(schema.entities.id, entityId),
    });
    return entity !== undefined;
  } catch {
    return false;
  }
}

export async function getHomeFromDb(db: DatabaseClient, homeId: string) {
  try {
    return await db.query.homes.findFirst({
      where: eq(schema.homes.id, homeId),
    });
  } catch {
    return null;
  }
}

export async function getDeviceFromDb(db: DatabaseClient, deviceId: string) {
  try {
    return await db.query.devices.findFirst({
      where: eq(schema.devices.id, deviceId),
    });
  } catch {
    return null;
  }
}

export async function getEntityFromDb(db: DatabaseClient, entityId: string) {
  try {
    return await db.query.entities.findFirst({
      where: eq(schema.entities.id, entityId),
    });
  } catch {
    return null;
  }
}

export async function getTelemetryFromDb(
  db: DatabaseClient,
  entityId: string,
  field?: string,
  limit = 100,
) {
  try {
    const conditions = field
      ? [
          eq(schema.telemetry.entityId, entityId),
          eq(schema.telemetry.field, field),
        ]
      : [eq(schema.telemetry.entityId, entityId)];

    return await db
      .select()
      .from(schema.telemetry)
      .where(and(...conditions))
      .limit(limit);
  } catch {
    return [];
  }
}

/**
 * Daemon helpers
 */

export async function waitForHubReady(
  daemon: HubDaemon,
  timeout = 10000,
): Promise<boolean> {
  return waitFor(() => {
    const status = daemon.getStatus();
    return (
      status.running &&
      status.components.registry &&
      status.components.stateStore
    );
  }, timeout);
}

export async function waitForDeviceDiscovered(
  db: DatabaseClient,
  deviceId: string,
  timeout = 5000,
): Promise<boolean> {
  return waitFor(() => verifyDeviceInDb(db, deviceId), timeout);
}

export async function waitForEntityCreated(
  db: DatabaseClient,
  entityId: string,
  timeout = 5000,
): Promise<boolean> {
  return waitFor(() => verifyEntityInDb(db, entityId), timeout);
}

export async function stopDaemon(daemon: HubDaemon): Promise<void> {
  if (daemon) {
    await daemon.stop();
    // Give it time to clean up
    await sleep(1000);
  }
}

/**
 * HTTP API helpers
 */

export async function makeHttpRequest(
  method: string,
  url: string,
  body?: unknown,
): Promise<Response> {
  const options: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
    method,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(url, options);
}

export async function waitForHttpServer(
  port: number,
  timeout = 10000,
): Promise<boolean> {
  return waitFor(async () => {
    try {
      const response = await makeHttpRequest(
        'GET',
        `http://localhost:${port}/`,
      );
      return response.ok;
    } catch {
      return false;
    }
  }, timeout);
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

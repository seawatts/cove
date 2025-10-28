/**
 * Mock implementations for Hub V2 testing
 */

import type {
  DeviceDescriptor,
  Driver,
  DriverCommand,
  DriverResult,
  EntityDescriptor,
} from '../core/driver-kit';
import {
  createMockDeviceDescriptor,
  createMockEntityDescriptor,
} from './factories';

/**
 * Mock ESPHome driver for testing
 * Implements the Driver interface with in-memory storage
 */
export class MockESPHomeDriver implements Driver {
  private devices = new Map<
    string,
    { descriptor: DeviceDescriptor; entities: EntityDescriptor[] }
  >();
  private subscriptions = new Map<string, Set<(state: unknown) => void>>();

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async shutdown(): Promise<void> {
    this.devices.clear();
    this.subscriptions.clear();
  }

  async *discover(): AsyncGenerator<DeviceDescriptor, void, unknown> {
    // Return no devices by default for testing
    // Tests can manually connect devices as needed
    yield* [];
  }

  async connect(deviceId: string, address: string): Promise<void> {
    const descriptor = createMockDeviceDescriptor('esphome', {
      address,
      id: deviceId,
    });
    const entities = [createMockEntityDescriptor(deviceId)];
    this.devices.set(deviceId, { descriptor, entities });
  }

  async disconnect(deviceId: string): Promise<void> {
    this.devices.delete(deviceId);
    // Clean up subscriptions for this device's entities
    for (const [entityId] of this.subscriptions) {
      if (entityId.startsWith(deviceId)) {
        this.subscriptions.delete(entityId);
      }
    }
  }

  async getDeviceInfo(deviceId: string): Promise<DeviceDescriptor | null> {
    return this.devices.get(deviceId)?.descriptor || null;
  }

  async getEntities(deviceId: string): Promise<EntityDescriptor[]> {
    return this.devices.get(deviceId)?.entities || [];
  }

  subscribeToEntity(
    entityId: string,
    callback: (state: unknown) => void,
  ): () => void {
    if (!this.subscriptions.has(entityId)) {
      this.subscriptions.set(entityId, new Set());
    }
    this.subscriptions.get(entityId)?.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscriptions.get(entityId)?.delete(callback);
    };
  }

  unsubscribeFromEntity(entityId: string): void {
    this.subscriptions.delete(entityId);
  }

  async invoke(
    _entityId: string,
    command: DriverCommand,
  ): Promise<DriverResult> {
    // Mock implementation always succeeds
    return {
      data: command.value,
      ok: true,
    };
  }

  async pair(
    deviceId: string,
    credentials?: Record<string, unknown>,
  ): Promise<void> {
    // Mock implementation - just store credentials
    if (credentials) {
      const existing = this.devices.get(deviceId);
      if (existing) {
        existing.descriptor.metadata = {
          ...existing.descriptor.metadata,
          ...credentials,
        };
      }
    }
  }

  subscribe(entityId: string, callback: (state: unknown) => void): () => void {
    return this.subscribeToEntity(entityId, callback);
  }

  async getState(entityId: string): Promise<unknown> {
    const device = Array.from(this.devices.values()).find((d) =>
      d.entities.some((e) => e.id === entityId),
    );

    const entity = device?.entities.find((e) => e.id === entityId);
    return entity?.capability.state ?? null;
  }
}

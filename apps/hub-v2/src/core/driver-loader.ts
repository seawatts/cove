/** biome-ignore-all lint/complexity/noStaticOnlyClass: This class is used for static methods only */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { debug } from '@cove/logger';
import type { Driver, DriverRegistry } from './driver-kit';

const log = debug('cove:hub-v2:driver-loader');

export interface DriverMetadata {
  protocol: string;
  name: string;
  version?: string;
}

export interface DriverExport {
  default?: new () => Driver;
  Driver?: new () => Driver;
  metadata?: DriverMetadata;
}

export interface DriverFunctionExports {
  default?: unknown;
  initialize?: () => Promise<void>;
  shutdown?: () => Promise<void>;
  discover?: () => AsyncGenerator<unknown, void, unknown>;
  connect?: (deviceId: string, address: string) => Promise<void>;
  disconnect?: (deviceId: string) => Promise<void>;
  getDeviceInfo?: (deviceId: string) => Promise<unknown>;
  getEntities?: (deviceId: string) => Promise<unknown[]>;
  subscribeToEntity?: (
    entityId: string,
    callback: (state: unknown) => void,
  ) => () => void;
  unsubscribeFromEntity?: (entityId: string) => void;
  invoke?: (_entityId: string, _command: unknown) => Promise<unknown>;
  pair?: (
    _deviceId: string,
    _credentials?: Record<string, unknown>,
  ) => Promise<void>;
  subscribe?: (
    _entityId: string,
    _callback: (state: unknown) => void,
  ) => () => void;
  getState?: (_entityId: string) => Promise<unknown>;
}

export class DriverLoader {
  static async loadDrivers(registry: DriverRegistry): Promise<void> {
    const drivers = await DriverLoader.discoverDrivers();

    log(`Discovered ${drivers.length} driver(s)`);

    for (const driver of drivers) {
      try {
        if (driver.type === 'class') {
          if (!driver.DriverClass) {
            log(`No DriverClass found for ${driver.protocol} driver`);
            continue;
          }
          const driverInstance = new driver.DriverClass();
          if (registry.registerAndInitialize) {
            await registry.registerAndInitialize(
              driver.protocol,
              driverInstance,
            );
          } else {
            await driverInstance.initialize();
            registry.register(driver.protocol, driverInstance);
          }
          log(
            `✓ Registered and initialized ${driver.name} driver (${driver.protocol})`,
          );
        } else if (driver.type === 'function') {
          if (!driver.functions) {
            log(`No functions found for ${driver.protocol} driver`);
            continue;
          }
          const driverInstance = DriverLoader.createDriverFromFunctions(
            driver.functions,
          );
          if (registry.registerAndInitialize) {
            await registry.registerAndInitialize(
              driver.protocol,
              driverInstance,
            );
          } else {
            await driverInstance.initialize();
            registry.register(driver.protocol, driverInstance);
          }
          log(
            `✓ Registered and initialized ${driver.name} driver (${driver.protocol})`,
          );
        }
      } catch (error) {
        log(`✗ Failed to load ${driver.protocol} driver:`, error);
      }
    }
  }

  private static createDriverFromFunctions(
    functions: DriverFunctionExports,
  ): Driver {
    return {
      connect: (functions.connect || (async () => {})) as Driver['connect'],
      disconnect: (functions.disconnect ||
        (async () => {})) as Driver['disconnect'],
      discover: (functions.discover ||
        async function* () {}) as Driver['discover'],
      getDeviceInfo: (functions.getDeviceInfo ||
        (async () => null)) as Driver['getDeviceInfo'],
      getEntities: (functions.getEntities ||
        (async () => [])) as Driver['getEntities'],
      getState: (functions.getState ||
        (async () => null)) as Driver['getState'],
      initialize: (functions.initialize ||
        (async () => {})) as Driver['initialize'],
      invoke: (functions.invoke ||
        (async () => ({
          error: 'Not implemented',
          ok: false,
        }))) as Driver['invoke'],
      pair: (functions.pair || (async () => {})) as Driver['pair'],
      shutdown: (functions.shutdown || (async () => {})) as Driver['shutdown'],
      subscribe: (functions.subscribe ||
        (() => () => {})) as Driver['subscribe'],
      subscribeToEntity: (functions.subscribeToEntity ||
        (() => () => {})) as Driver['subscribeToEntity'],
      unsubscribeFromEntity: (functions.unsubscribeFromEntity ||
        (() => {})) as Driver['unsubscribeFromEntity'],
    };
  }

  private static async discoverDrivers(): Promise<
    Array<{
      type: 'class' | 'function';
      protocol: string;
      name: string;
      DriverClass?: new () => Driver;
      functions?: DriverFunctionExports;
    }>
  > {
    const drivers: Array<{
      type: 'class' | 'function';
      protocol: string;
      name: string;
      DriverClass?: new () => Driver;
      functions?: DriverFunctionExports;
    }> = [];

    const driversDir = path.resolve(import.meta.dir, '../drivers');

    try {
      const items = await readdir(driversDir);

      for (const item of items) {
        const itemPath = path.join(driversDir, item);
        const itemStat = await stat(itemPath);

        // Handle file-based (class) drivers
        if (
          itemStat.isFile() &&
          item.endsWith('.ts') &&
          !item.endsWith('.test.ts')
        ) {
          try {
            const module = (await import(itemPath)) as DriverExport;

            // Support both default export and named export
            const DriverClass = module.default || module.Driver;

            if (!DriverClass) {
              log(`Warning: ${item} does not export a Driver class`);
              continue;
            }

            const protocol =
              module.metadata?.protocol ||
              item.replace('.ts', '').toLowerCase();
            const name =
              module.metadata?.name ||
              item
                .replace('.ts', '')
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            drivers.push({ DriverClass, name, protocol, type: 'class' });
          } catch (error) {
            log(`Failed to import ${item}:`, error);
          }
        }
        // Handle folder-based (function) drivers
        else if (itemStat.isDirectory()) {
          try {
            const result = await DriverLoader.loadFolderDriver(
              driversDir,
              item,
            );
            if (result) {
              drivers.push(result);
            }
          } catch (error) {
            log(`Failed to load folder driver ${item}:`, error);
          }
        }
      }
    } catch (error) {
      log('Failed to read drivers directory:', error);
    }

    return drivers;
  }

  private static async loadFolderDriver(
    driversDir: string,
    folderName: string,
  ): Promise<{
    type: 'function';
    protocol: string;
    name: string;
    functions: DriverFunctionExports;
  } | null> {
    const folderPath = path.join(driversDir, folderName);
    const requiredFiles = [
      'lifecycle.ts',
      'discovery.ts',
      'connection.ts',
      'entities.ts',
      'subscription.ts',
      'commands.ts',
      'pairing.ts',
    ];

    // Check all required files exist
    for (const file of requiredFiles) {
      const filePath = path.join(folderPath, file);
      try {
        await stat(filePath);
      } catch {
        throw new Error(`Missing required file: ${folderName}/${file}`);
      }
    }

    // Load metadata
    let protocol = folderName.toLowerCase();
    let name = folderName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    try {
      const metadataModule = await import(path.join(folderPath, 'metadata.ts'));
      if (metadataModule.metadata) {
        protocol = metadataModule.metadata.protocol;
        name = metadataModule.metadata.name;
      }
    } catch {
      log(`No metadata file found for ${folderName}, using defaults`);
    }

    // Load function modules
    const lifecycle = (await import(
      path.join(folderPath, 'lifecycle.ts')
    )) as unknown as DriverFunctionExports;
    const discovery = (await import(
      path.join(folderPath, 'discovery.ts')
    )) as unknown as DriverFunctionExports;
    const connection = (await import(
      path.join(folderPath, 'connection.ts')
    )) as unknown as DriverFunctionExports;
    const entities = (await import(
      path.join(folderPath, 'entities.ts')
    )) as unknown as DriverFunctionExports;
    const subscription = (await import(
      path.join(folderPath, 'subscription.ts')
    )) as unknown as DriverFunctionExports;
    const commands = (await import(
      path.join(folderPath, 'commands.ts')
    )) as unknown as DriverFunctionExports;
    const pairing = (await import(
      path.join(folderPath, 'pairing.ts')
    )) as unknown as DriverFunctionExports;

    // Compose functions object
    const functions: DriverFunctionExports = {
      connect:
        (connection.default as typeof connection.connect) || connection.connect,
      disconnect: connection.disconnect,
      discover:
        (discovery.default as typeof discovery.discover) || discovery.discover,
      getDeviceInfo: entities.getDeviceInfo,
      getEntities:
        (entities.default as typeof entities.getEntities) ||
        entities.getEntities,
      getState: subscription.getState,
      initialize:
        (lifecycle.default as typeof lifecycle.initialize) ||
        lifecycle.initialize,
      invoke: (commands.default as typeof commands.invoke) || commands.invoke,
      pair: (pairing.default as typeof pairing.pair) || pairing.pair,
      shutdown: lifecycle.shutdown,
      subscribe: subscription.subscribe,
      subscribeToEntity:
        (subscription.default as typeof subscription.subscribeToEntity) ||
        subscription.subscribeToEntity,
      unsubscribeFromEntity: subscription.unsubscribeFromEntity,
    };

    return { functions, name, protocol, type: 'function' };
  }
}

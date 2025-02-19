import { EventEmitter } from 'node:events';

interface ShadowState {
  desired: Record<string, unknown>;
  reported: Record<string, unknown>;
  delta: Record<string, unknown>;
}

interface Device {
  type: string;
  shadowState: ShadowState;
}

interface DiscoveredDevice extends Device {
  name: string;
  ipAddress: string;
}

(async () => {
  /// DISCOVERY
  // TODO: Load integrations from config manifest.yaml (Hue, HomeKit, Aquara, etc.)
  // TODO: Loop through integration config and create a new instance of the integration
  // TODO: Call the setup method for each integration
  // TODO: Call the discoverDevices method for each integration
  // TODO: Log the discovered devices // store them with the registry / db
  // CONTROLLER
  //
})();

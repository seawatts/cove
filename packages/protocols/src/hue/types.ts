/**
 * Philips Hue Protocol Types
 *
 * Based on CLIP API v1 and v2
 * References:
 * - https://developers.meethue.com/develop/hue-api/
 * - https://developers.meethue.com/develop/hue-api-v2/
 */

/**
 * Hue Bridge Discovery
 */
export interface HueBridgeDiscovery {
  id: string; // Unique bridge ID
  internalipaddress: string; // Local IP address
  port?: number; // Default: 443 (HTTPS) or 80 (HTTP - deprecated)
  name?: string; // Bridge name
  modelid?: string; // Bridge model (e.g., "BSB002")
  swversion?: string; // Firmware version
}

/**
 * Hue Bridge Configuration
 */
export interface HueBridgeConfig {
  name: string;
  swversion: string;
  apiversion: string;
  mac: string;
  bridgeid: string;
  factorynew: boolean;
  modelid: string;
  datastoreversion: string;
}

/**
 * Hue Authentication
 */
export interface HueAuthRequest {
  devicetype: string; // "app_name#device_name"
  generateclientkey?: boolean; // For streaming/entertainment API
}

export interface HueAuthResponse {
  success?: {
    username: string; // API key
    clientkey?: string; // For streaming
  };
  error?: {
    type: number;
    address: string;
    description: string;
  };
}

/**
 * Hue Light State
 */
export interface HueLightState {
  on: boolean; // On/off state
  bri?: number; // Brightness (0-254)
  hue?: number; // Hue (0-65535)
  sat?: number; // Saturation (0-254)
  ct?: number; // Color temperature (153-500 mireds)
  xy?: [number, number]; // CIE color space coordinates
  alert?: 'none' | 'select' | 'lselect'; // Alert effect
  effect?: 'none' | 'colorloop'; // Dynamic effect
  transitiontime?: number; // Transition time in deciseconds (1/10 sec)
  bri_inc?: number; // Increment/decrement brightness
  sat_inc?: number; // Increment/decrement saturation
  hue_inc?: number; // Increment/decrement hue
  ct_inc?: number; // Increment/decrement color temp
  xy_inc?: [number, number]; // Increment/decrement xy
  colormode?: 'hs' | 'xy' | 'ct'; // Current color mode (read-only)
  reachable?: boolean; // Reachable status (read-only)
}

/**
 * Hue Light Capabilities
 */
export interface HueLightCapabilities {
  certified: boolean;
  control: {
    mindimlevel?: number;
    maxlumen?: number;
    colorgamuttype?: string;
    colorgamut?: [[number, number], [number, number], [number, number]];
    ct?: {
      min: number;
      max: number;
    };
  };
  streaming?: {
    renderer: boolean;
    proxy: boolean;
  };
}

/**
 * Hue Light
 */
export interface HueLight {
  state: HueLightState;
  swupdate?: {
    state: string;
    lastinstall: string;
  };
  type: string; // "Extended color light", "Color temperature light", etc.
  name: string;
  modelid: string;
  manufacturername: string;
  productname?: string;
  capabilities?: HueLightCapabilities;
  config?: {
    archetype: string;
    function: string;
    direction: string;
    startup?: {
      mode: string;
      configured: boolean;
    };
  };
  uniqueid: string;
  swversion: string;
  swconfigid?: string;
  productid?: string;
}

/**
 * Hue Group (Room/Zone)
 */
export interface HueGroup {
  name: string;
  lights: string[]; // Array of light IDs
  sensors?: string[]; // Array of sensor IDs
  type: 'LightGroup' | 'Room' | 'Entertainment' | 'Zone';
  state?: {
    all_on: boolean;
    any_on: boolean;
  };
  recycle?: boolean;
  class?:
    | 'Living room'
    | 'Kitchen'
    | 'Dining'
    | 'Bedroom'
    | 'Kids bedroom'
    | 'Bathroom'
    | 'Nursery'
    | 'Recreation'
    | 'Office'
    | 'Gym'
    | 'Hallway'
    | 'Toilet'
    | 'Front door'
    | 'Garage'
    | 'Terrace'
    | 'Garden'
    | 'Driveway'
    | 'Carport'
    | 'Other';
  action?: HueLightState;
}

/**
 * Hue Scene
 */
export interface HueScene {
  name: string;
  type: 'LightScene' | 'GroupScene';
  group?: string; // Group ID if GroupScene
  lights: string[]; // Array of light IDs
  owner?: string;
  recycle?: boolean;
  locked?: boolean;
  appdata?: {
    version: number;
    data: string;
  };
  picture?: string;
  lastupdated?: string;
  version?: number;
}

/**
 * Hue Sensor
 */
export interface HueSensor {
  state: Record<string, unknown>; // Sensor-specific state
  config: {
    on: boolean;
    reachable?: boolean;
    battery?: number;
  };
  name: string;
  type: string;
  modelid: string;
  manufacturername: string;
  swversion?: string;
  uniqueid?: string;
  capabilities?: {
    certified: boolean;
  };
}

/**
 * Hue Schedule
 */
export interface HueSchedule {
  name: string;
  description: string;
  command: {
    address: string;
    method: 'POST' | 'PUT' | 'DELETE';
    body: Record<string, unknown>;
  };
  localtime: string;
  time?: string;
  created?: string;
  status: 'enabled' | 'disabled';
  autodelete?: boolean;
  starttime?: string;
}

/**
 * Hue Rule
 */
export interface HueRule {
  name: string;
  owner?: string;
  created?: string;
  lasttriggered?: string;
  timestriggered?: number;
  status: 'enabled' | 'disabled';
  conditions: Array<{
    address: string;
    operator:
      | 'eq'
      | 'gt'
      | 'lt'
      | 'dx'
      | 'ddx'
      | 'stable'
      | 'not stable'
      | 'in'
      | 'not in';
    value: string;
  }>;
  actions: Array<{
    address: string;
    method: 'POST' | 'PUT' | 'DELETE';
    body: Record<string, unknown>;
  }>;
}

/**
 * Hue Resource Map (all resources from bridge)
 */
export interface HueResources {
  lights: Record<string, HueLight>;
  groups: Record<string, HueGroup>;
  scenes: Record<string, HueScene>;
  sensors?: Record<string, HueSensor>;
  schedules?: Record<string, HueSchedule>;
  rules?: Record<string, HueRule>;
  config: HueBridgeConfig;
}

/**
 * Hue Client Options
 */
export interface HueClientOptions {
  host: string; // Bridge IP address
  port?: number; // Default: 443 (HTTPS) or 80 (HTTP)
  username?: string; // API key (if already authenticated)
  clientkey?: string; // For entertainment API
  timeout?: number; // Request timeout in ms
  useHttps?: boolean; // Use HTTPS (recommended, default: true)
}

/**
 * Hue Event (SSE - API v2)
 */
export interface HueEvent {
  creationtime: string;
  id: string;
  type: 'update' | 'add' | 'delete';
  data: Array<{
    id: string;
    type: string;
    [key: string]: unknown;
  }>;
}

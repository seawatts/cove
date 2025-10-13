/**
 * Philips Hue Client
 *
 * REST API client for Philips Hue Bridge
 * Supports both HTTP and HTTPS (recommended)
 */

import { EventEmitter } from 'node:events';
import { debug } from '@cove/logger';
import type {
  HueAuthRequest,
  HueAuthResponse,
  HueBridgeConfig,
  HueClientOptions,
  HueGroup,
  HueLight,
  HueLightState,
  HueResources,
  HueScene,
} from './types';

const log = debug('cove:protocols:hue:client');

export class HueClient extends EventEmitter {
  private baseURL: string;
  private username?: string;
  private timeout: number;
  private connected = false;

  constructor(options: HueClientOptions) {
    super();

    const protocol = options.useHttps !== false ? 'https' : 'http';
    const port = options.port || (options.useHttps !== false ? 443 : 80);
    const portSuffix =
      port === (protocol === 'https' ? 443 : 80) ? '' : `:${port}`;

    this.baseURL = `${protocol}://${options.host}${portSuffix}`;
    this.username = options.username;
    this.timeout = options.timeout || 5000;

    log(`Hue client initialized: ${this.baseURL}`);
  }

  /**
   * Authenticate with the bridge
   * Requires physical button press on the bridge
   */
  async authenticate(devicetype = 'cove#hub'): Promise<string> {
    log('Attempting authentication (press link button on bridge)');

    const request: HueAuthRequest = { devicetype };
    const response = await this.request<HueAuthResponse[]>(
      'POST',
      '/api',
      request,
    );

    if (!response || response.length === 0) {
      throw new Error('Empty response from bridge');
    }

    const result = response[0];

    if (!result) {
      throw new Error('Empty response from bridge');
    }

    if (result.error) {
      throw new Error(`Authentication failed: ${result.error.description}`);
    }

    if (!result.success?.username) {
      throw new Error('No username in authentication response');
    }

    this.username = result.success.username;
    log(`Authentication successful, username: ${this.username}`);

    return this.username;
  }

  /**
   * Test connection to bridge
   */
  async connect(): Promise<void> {
    if (!this.username) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    log('Testing connection to bridge');

    // Get config to test connection
    const config = await this.getBridgeConfig();

    this.connected = true;
    log(`Connected to bridge: ${config.name} (v${config.swversion})`);

    this.emit('connected', config);
  }

  /**
   * Disconnect from bridge
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
    log('Disconnected from bridge');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get bridge configuration
   */
  async getBridgeConfig(): Promise<HueBridgeConfig> {
    return this.request<HueBridgeConfig>('GET', `/api/${this.username}/config`);
  }

  /**
   * Get all resources (lights, groups, scenes, etc.)
   */
  async getAll(): Promise<HueResources> {
    return this.request<HueResources>('GET', `/api/${this.username}`);
  }

  /**
   * Get all lights
   */
  async getLights(): Promise<Record<string, HueLight>> {
    return this.request<Record<string, HueLight>>(
      'GET',
      `/api/${this.username}/lights`,
    );
  }

  /**
   * Get a specific light
   */
  async getLight(id: string): Promise<HueLight> {
    return this.request<HueLight>('GET', `/api/${this.username}/lights/${id}`);
  }

  /**
   * Set light state
   */
  async setLightState(
    id: string,
    state: Partial<HueLightState>,
  ): Promise<unknown> {
    log(`Setting light ${id} state:`, state);
    return this.request(
      'PUT',
      `/api/${this.username}/lights/${id}/state`,
      state,
    );
  }

  /**
   * Turn light on/off
   */
  async toggleLight(id: string, on: boolean): Promise<unknown> {
    return this.setLightState(id, { on });
  }

  /**
   * Set light brightness (0-254)
   */
  async setBrightness(id: string, brightness: number): Promise<unknown> {
    return this.setLightState(id, {
      bri: Math.max(0, Math.min(254, brightness)),
    });
  }

  /**
   * Set light color (hue: 0-65535, saturation: 0-254)
   */
  async setColor(
    id: string,
    hue: number,
    saturation: number,
  ): Promise<unknown> {
    return this.setLightState(id, {
      hue: Math.max(0, Math.min(65535, hue)),
      sat: Math.max(0, Math.min(254, saturation)),
    });
  }

  /**
   * Set light color temperature (153-500 mireds)
   */
  async setColorTemperature(id: string, ct: number): Promise<unknown> {
    return this.setLightState(id, { ct: Math.max(153, Math.min(500, ct)) });
  }

  /**
   * Set light XY color
   */
  async setXY(id: string, x: number, y: number): Promise<unknown> {
    return this.setLightState(id, { xy: [x, y] });
  }

  /**
   * Rename a light
   */
  async renameLight(id: string, name: string): Promise<unknown> {
    return this.request('PUT', `/api/${this.username}/lights/${id}`, { name });
  }

  /**
   * Get all groups
   */
  async getGroups(): Promise<Record<string, HueGroup>> {
    return this.request<Record<string, HueGroup>>(
      'GET',
      `/api/${this.username}/groups`,
    );
  }

  /**
   * Get a specific group
   */
  async getGroup(id: string): Promise<HueGroup> {
    return this.request<HueGroup>('GET', `/api/${this.username}/groups/${id}`);
  }

  /**
   * Set group state
   */
  async setGroupState(
    id: string,
    state: Partial<HueLightState>,
  ): Promise<unknown> {
    log(`Setting group ${id} state:`, state);
    return this.request(
      'PUT',
      `/api/${this.username}/groups/${id}/action`,
      state,
    );
  }

  /**
   * Create a new group
   */
  async createGroup(
    name: string,
    lights: string[],
    type: HueGroup['type'] = 'LightGroup',
  ): Promise<unknown> {
    return this.request('POST', `/api/${this.username}/groups`, {
      lights,
      name,
      type,
    });
  }

  /**
   * Delete a group
   */
  async deleteGroup(id: string): Promise<unknown> {
    return this.request('DELETE', `/api/${this.username}/groups/${id}`);
  }

  /**
   * Get all scenes
   */
  async getScenes(): Promise<Record<string, HueScene>> {
    return this.request<Record<string, HueScene>>(
      'GET',
      `/api/${this.username}/scenes`,
    );
  }

  /**
   * Get a specific scene
   */
  async getScene(id: string): Promise<HueScene> {
    return this.request<HueScene>('GET', `/api/${this.username}/scenes/${id}`);
  }

  /**
   * Activate a scene
   */
  async activateScene(sceneId: string, groupId?: string): Promise<unknown> {
    const endpoint = groupId
      ? `/api/${this.username}/groups/${groupId}/action`
      : `/api/${this.username}/groups/0/action`;

    log(`Activating scene ${sceneId}`);
    return this.request('PUT', endpoint, { scene: sceneId });
  }

  /**
   * Create a new scene
   */
  async createScene(
    name: string,
    lights: string[],
    type: HueScene['type'] = 'LightScene',
  ): Promise<unknown> {
    return this.request('POST', `/api/${this.username}/scenes`, {
      lights,
      name,
      type,
    });
  }

  /**
   * Delete a scene
   */
  async deleteScene(id: string): Promise<unknown> {
    return this.request('DELETE', `/api/${this.username}/scenes/${id}`);
  }

  /**
   * Make HTTP request to bridge
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;

    log(`${method} ${path}`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
        },
        method,
        // For HTTPS with self-signed certs (local bridge)
        // @ts-expect-error - Bun specific, Node.js uses different approach
        rejectUnauthorized: false,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as T;
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      log('Request failed:', error);
      throw error;
    }
  }
}

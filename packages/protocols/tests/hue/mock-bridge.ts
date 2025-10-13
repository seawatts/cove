/**
 * Mock Hue Bridge for Testing
 *
 * Simulates a Philips Hue Bridge REST API for unit tests
 */

import type {
  HueAuthResponse,
  HueBridgeConfig,
  HueGroup,
  HueLight,
  HueLightState,
  HueScene,
} from '../../src/hue/types';

export interface MockBridgeOptions {
  port?: number;
  requireAuth?: boolean;
  lights?: Record<string, HueLight>;
  groups?: Record<string, HueGroup>;
  scenes?: Record<string, HueScene>;
}

/**
 * Mock Hue Bridge Server
 */
export class MockHueBridge {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private port: number;
  private requireAuth: boolean;
  private validUsername = 'test-username-1234567890';
  private lights: Record<string, HueLight>;
  private groups: Record<string, HueGroup>;
  private scenes: Record<string, HueScene>;
  private lightStates: Record<string, HueLightState>;
  private groupStates: Record<string, HueLightState>;
  private linkButtonPressed = false;

  constructor(options: MockBridgeOptions = {}) {
    this.port = options.port || 8080;
    this.requireAuth = options.requireAuth ?? true;
    this.lights = options.lights || this.createMockLights();
    this.groups = options.groups || this.createMockGroups();
    this.scenes = options.scenes || this.createMockScenes();

    // Initialize light states
    this.lightStates = {};
    for (const [id, light] of Object.entries(this.lights)) {
      this.lightStates[id] = { ...light.state };
    }

    // Initialize group states
    this.groupStates = {};
  }

  /**
   * Start the mock bridge server
   */
  start(): void {
    this.server = Bun.serve({
      fetch: (req) => this.handleRequest(req),
      port: this.port,
    });
  }

  /**
   * Stop the mock bridge server
   */
  stop(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }

  /**
   * Press the link button (allows authentication)
   */
  pressLinkButton(): void {
    this.linkButtonPressed = true;
    // Auto-release after 30 seconds
    setTimeout(() => {
      this.linkButtonPressed = false;
    }, 30000);
  }

  /**
   * Get the base URL
   */
  getBaseURL(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Get the valid username
   */
  getUsername(): string {
    return this.validUsername;
  }

  /**
   * Handle incoming requests
   */
  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Authentication endpoint
    if (method === 'POST' && path === '/api') {
      return this.handleAuth(req);
    }

    // Extract username from path
    const apiMatch = path.match(/^\/api\/([^/]+)/);
    if (!apiMatch) {
      return this.jsonResponse({ error: 'Invalid API path' }, 400);
    }

    const username = apiMatch[1];

    // Verify authentication if required
    if (this.requireAuth && username !== this.validUsername) {
      return this.jsonResponse(
        [
          {
            error: {
              address: path,
              description: 'unauthorized user',
              type: 1,
            },
          },
        ],
        403,
      );
    }

    // Route to appropriate handler
    if (path.includes('/config')) {
      return this.handleConfig();
    }
    if (path.includes('/lights')) {
      return this.handleLights(method, path, req);
    }
    if (path.includes('/groups')) {
      return this.handleGroups(method, path, req);
    }
    if (path.includes('/scenes')) {
      return this.handleScenes(method, path, req);
    }
    if (path === `/api/${username}`) {
      return this.handleGetAll();
    }

    return this.jsonResponse({ error: 'Not found' }, 404);
  }

  /**
   * Handle authentication
   */
  private async handleAuth(_req: Request): Promise<Response> {
    if (!this.linkButtonPressed) {
      const response: HueAuthResponse[] = [
        {
          error: {
            address: '',
            description: 'link button not pressed',
            type: 101,
          },
        },
      ];
      return this.jsonResponse(response);
    }

    const response: HueAuthResponse[] = [
      {
        success: {
          username: this.validUsername,
        },
      },
    ];

    return this.jsonResponse(response);
  }

  /**
   * Handle config request
   */
  private handleConfig(): Response {
    const config: HueBridgeConfig = {
      apiversion: '1.65.0',
      bridgeid: '001788FFFE000000',
      datastoreversion: '150',
      factorynew: false,
      mac: '00:17:88:00:00:00',
      modelid: 'BSB002',
      name: 'Mock Hue Bridge',
      swversion: '1.65.0',
    };

    return this.jsonResponse(config);
  }

  /**
   * Handle lights endpoints
   */
  private async handleLights(
    method: string,
    path: string,
    req: Request,
  ): Promise<Response> {
    const lightMatch = path.match(/\/lights\/(\d+)/);

    if (!lightMatch) {
      // Get all lights
      return this.jsonResponse(this.lights);
    }

    const lightId = lightMatch[1];

    if (method === 'GET') {
      // Get specific light
      if (!this.lights[lightId]) {
        return this.jsonResponse({ error: 'Light not found' }, 404);
      }
      return this.jsonResponse({
        ...this.lights[lightId],
        state: this.lightStates[lightId],
      });
    }

    if (method === 'PUT' && path.includes('/state')) {
      // Update light state
      const body = (await req.json()) as Partial<HueLightState>;
      this.lightStates[lightId] = {
        ...this.lightStates[lightId],
        ...body,
      };

      const response = Object.keys(body).map((key) => ({
        success: {
          [`/lights/${lightId}/state/${key}`]: body[key as keyof HueLightState],
        },
      }));

      return this.jsonResponse(response);
    }

    if (method === 'PUT') {
      // Update light attributes
      const body = (await req.json()) as { name?: string };
      if (body.name) {
        this.lights[lightId] = {
          ...this.lights[lightId],
          name: body.name,
        };
      }

      return this.jsonResponse([
        { success: { [`/lights/${lightId}/name`]: body.name } },
      ]);
    }

    return this.jsonResponse({ error: 'Method not allowed' }, 405);
  }

  /**
   * Handle groups endpoints
   */
  private async handleGroups(
    method: string,
    path: string,
    req: Request,
  ): Promise<Response> {
    const groupMatch = path.match(/\/groups\/(\d+)/);

    if (!groupMatch) {
      if (method === 'GET') {
        // Get all groups
        return this.jsonResponse(this.groups);
      }
      if (method === 'POST') {
        // Create new group
        const body = (await req.json()) as {
          name: string;
          lights: string[];
          type?: string;
        };
        const newId = String(Object.keys(this.groups).length + 1);
        this.groups[newId] = {
          lights: body.lights,
          name: body.name,
          type: (body.type as HueGroup['type']) || 'LightGroup',
        };
        return this.jsonResponse([{ success: { id: newId } }]);
      }
    }

    const groupId = groupMatch[1];

    if (method === 'GET') {
      // Get specific group
      if (!this.groups[groupId]) {
        return this.jsonResponse({ error: 'Group not found' }, 404);
      }
      return this.jsonResponse(this.groups[groupId]);
    }

    if (method === 'PUT' && path.includes('/action')) {
      // Update group action
      const body = (await req.json()) as Partial<HueLightState>;
      this.groupStates[groupId] = {
        ...this.groupStates[groupId],
        ...body,
      };

      const response = Object.keys(body).map((key) => ({
        success: {
          [`/groups/${groupId}/action/${key}`]:
            body[key as keyof HueLightState],
        },
      }));

      return this.jsonResponse(response);
    }

    if (method === 'DELETE') {
      // Delete group
      delete this.groups[groupId];
      return this.jsonResponse([{ success: `/groups/${groupId} deleted` }]);
    }

    return this.jsonResponse({ error: 'Method not allowed' }, 405);
  }

  /**
   * Handle scenes endpoints
   */
  private async handleScenes(
    method: string,
    path: string,
    req: Request,
  ): Promise<Response> {
    const sceneMatch = path.match(/\/scenes\/([\w-]+)/);

    if (!sceneMatch) {
      if (method === 'GET') {
        // Get all scenes
        return this.jsonResponse(this.scenes);
      }
      if (method === 'POST') {
        // Create new scene
        const body = (await req.json()) as {
          name: string;
          lights: string[];
          type?: string;
        };
        const newId = `scene-${Date.now()}`;
        this.scenes[newId] = {
          lights: body.lights,
          name: body.name,
          type: (body.type as HueScene['type']) || 'LightScene',
        };
        return this.jsonResponse([{ success: { id: newId } }]);
      }
    }

    const sceneId = sceneMatch[1];

    if (method === 'GET') {
      // Get specific scene
      if (!this.scenes[sceneId]) {
        return this.jsonResponse({ error: 'Scene not found' }, 404);
      }
      return this.jsonResponse(this.scenes[sceneId]);
    }

    if (method === 'DELETE') {
      // Delete scene
      delete this.scenes[sceneId];
      return this.jsonResponse([{ success: `/scenes/${sceneId} deleted` }]);
    }

    return this.jsonResponse({ error: 'Method not allowed' }, 405);
  }

  /**
   * Handle get all resources
   */
  private handleGetAll(): Response {
    return this.jsonResponse({
      config: {
        apiversion: '1.65.0',
        bridgeid: '001788FFFE000000',
        datastoreversion: '150',
        factorynew: false,
        mac: '00:17:88:00:00:00',
        modelid: 'BSB002',
        name: 'Mock Hue Bridge',
        swversion: '1.65.0',
      },
      groups: this.groups,
      lights: this.lights,
      scenes: this.scenes,
    });
  }

  /**
   * Helper to create JSON response
   */
  private jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
      status,
    });
  }

  /**
   * Create mock lights
   */
  private createMockLights(): Record<string, HueLight> {
    return {
      '1': {
        manufacturername: 'Signify Netherlands B.V.',
        modelid: 'LCT015',
        name: 'Living Room 1',
        state: {
          alert: 'none',
          bri: 254,
          colormode: 'ct',
          ct: 366,
          effect: 'none',
          hue: 8418,
          on: false,
          reachable: true,
          sat: 140,
          xy: [0.4573, 0.41],
        },
        swversion: '1.88.1',
        type: 'Extended color light',
        uniqueid: '00:17:88:01:00:00:00:00-0b',
      },
      '2': {
        manufacturername: 'Signify Netherlands B.V.',
        modelid: 'LTW001',
        name: 'Bedroom 1',
        state: {
          alert: 'none',
          bri: 200,
          colormode: 'ct',
          ct: 350,
          on: true,
          reachable: true,
        },
        swversion: '1.88.1',
        type: 'Color temperature light',
        uniqueid: '00:17:88:01:00:00:00:01-0b',
      },
    };
  }

  /**
   * Create mock groups
   */
  private createMockGroups(): Record<string, HueGroup> {
    return {
      '1': {
        class: 'Living room',
        lights: ['1'],
        name: 'Living Room',
        state: {
          all_on: false,
          any_on: false,
        },
        type: 'Room',
      },
      '2': {
        class: 'Bedroom',
        lights: ['2'],
        name: 'Bedroom',
        state: {
          all_on: true,
          any_on: true,
        },
        type: 'Room',
      },
    };
  }

  /**
   * Create mock scenes
   */
  private createMockScenes(): Record<string, HueScene> {
    return {
      'scene-1': {
        lights: ['1', '2'],
        name: 'Relax',
        type: 'LightScene',
      },
      'scene-2': {
        lights: ['1', '2'],
        name: 'Energize',
        type: 'LightScene',
      },
    };
  }
}

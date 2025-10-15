/**
 * Hub types for Cove home automation platform
 */

export interface Hub {
  id: string;
  name: string;
  version: string;

  ipAddress?: string;
  macAddress?: string;

  online: boolean;
  lastSeen: Date;

  // System info
  systemInfo?: {
    platform?: string; // 'linux', 'darwin', 'win32'
    arch?: string; // 'arm64', 'x64'
    hostname?: string;
    uptime?: number; // seconds
    memory?: {
      total: number;
      free: number;
      used: number;
    };
    cpu?: {
      count: number;
      model?: string;
      usage?: number; // percentage
    };
  };

  // Configuration
  config?: HubConfig;

  // Ownership
  userId: string;
  orgId?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface HubConfig {
  // Discovery settings
  discoveryEnabled: boolean;
  discoveryInterval: number; // seconds

  // Protocols to scan for
  enabledProtocols: string[];

  // Telemetry settings
  telemetryInterval: number; // seconds

  // Update settings
  autoUpdate: boolean;
  updateChannel: 'stable' | 'beta' | 'dev';

  // Network settings
  apiPort: number;
  wsPort?: number;
}

export interface HubHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number; // seconds

  // Component health
  components: {
    daemon: 'ok' | 'warning' | 'error';
    database: 'ok' | 'warning' | 'error';
    supabase: 'ok' | 'warning' | 'error';
    discovery: 'ok' | 'warning' | 'error';
  };

  // Stats
  stats: {
    devicesConnected: number;
    devicesOnline: number;
    messagesProcessed: number;
    queueLag: number;
    activeAdapters: number;
    recentErrors: number;
  };

  timestamp: Date;
}

export interface HubUpdate {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  checksum: string;
  publishedAt: Date;
}

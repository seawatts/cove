/**
 * Hub Connection Manager
 * Detects hub availability and routes API calls appropriately
 *
 * Connection Modes:
 * - LOCAL: Direct connection to hub on local network (best)
 * - REMOTE: Connection via CloudFlare Tunnel (good)
 * - CLOUD: Fallback to cloud mirror (view-only, may be stale)
 * - OFFLINE: No connection available
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ConnectionMode = 'local' | 'remote' | 'cloud' | 'offline';

export interface ConnectionStatus {
  mode: ConnectionMode;
  hubId: string | null;
  localUrl: string | null;
  remoteUrl: string | null;
  lastChecked: number;
  latency: number | null;
  online: boolean;
}

interface HubConnectionStore {
  status: ConnectionStatus;
  isChecking: boolean;
  checkConnection: (hubId: string) => Promise<void>;
  setMode: (mode: ConnectionMode) => void;
}

// Default status
const defaultStatus: ConnectionStatus = {
  hubId: null,
  lastChecked: 0,
  latency: null,
  localUrl: null,
  mode: 'cloud',
  online: false,
  remoteUrl: null,
};

/**
 * Hub connection store
 * Persists connection info across page reloads
 */
export const useHubConnection = create<HubConnectionStore>()(
  persist(
    (set, get) => ({
      /**
       * Check hub connection and determine best mode
       */
      checkConnection: async (hubId: string) => {
        const currentStatus = get().status;

        // Don't check too frequently (max once per 10 seconds)
        if (Date.now() - currentStatus.lastChecked < 10000) {
          return;
        }

        set({ isChecking: true });

        try {
          // Get hub info from cloud
          const hubInfo = await fetch(
            `/api/trpc/hubRegistry.get?input=${encodeURIComponent(JSON.stringify({ hubId }))}`,
          ).then((res) => res.json());

          if (!hubInfo?.result?.data) {
            throw new Error('Hub not found');
          }

          const hub = hubInfo.result.data;
          const localUrl = hub.localUrl;
          const remoteUrl = hub.cloudUrl;

          // Try local connection first
          const localResult = await checkHubHealth(localUrl);
          if (localResult.online) {
            set({
              isChecking: false,
              status: {
                hubId,
                lastChecked: Date.now(),
                latency: localResult.latency,
                localUrl,
                mode: 'local',
                online: true,
                remoteUrl,
              },
            });
            return;
          }

          // Try remote connection if available
          if (remoteUrl) {
            const remoteResult = await checkHubHealth(remoteUrl);
            if (remoteResult.online) {
              set({
                isChecking: false,
                status: {
                  hubId,
                  lastChecked: Date.now(),
                  latency: remoteResult.latency,
                  localUrl,
                  mode: 'remote',
                  online: true,
                  remoteUrl,
                },
              });
              return;
            }
          }

          // Fall back to cloud mirror
          set({
            isChecking: false,
            status: {
              hubId,
              lastChecked: Date.now(),
              latency: null,
              localUrl,
              mode: 'cloud',
              online: false,
              remoteUrl,
            },
          });
        } catch (error) {
          console.error('Failed to check hub connection:', error);
          set({
            isChecking: false,
            status: {
              ...currentStatus,
              lastChecked: Date.now(),
              mode: 'offline',
              online: false,
            },
          });
        }
      },
      isChecking: false,

      /**
       * Manually set connection mode
       */
      setMode: (mode: ConnectionMode) => {
        set((state) => ({
          status: {
            ...state.status,
            mode,
            online: mode === 'local' || mode === 'remote',
          },
        }));
      },
      status: defaultStatus,
    }),
    {
      name: 'hub-connection',
      partialize: (state) => ({
        status: {
          ...state.status,
          // Don't persist checking state
          lastChecked: 0,
        },
      }),
    },
  ),
);

/**
 * Check if hub is reachable at given URL
 */
async function checkHubHealth(url: string): Promise<{
  online: boolean;
  latency: number | null;
}> {
  if (!url) {
    return { latency: null, online: false };
  }

  try {
    const start = Date.now();
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    const latency = Date.now() - start;

    if (response.ok) {
      return { latency, online: true };
    }

    return { latency: null, online: false };
  } catch (error) {
    console.debug(`Hub health check failed for ${url}:`, error);
    return { latency: null, online: false };
  }
}

/**
 * Get current hub API URL based on connection mode
 */
export function getHubApiUrl(status: ConnectionStatus): string | null {
  switch (status.mode) {
    case 'local':
      return status.localUrl;
    case 'remote':
      return status.remoteUrl;
    case 'cloud':
    case 'offline':
      return null; // Use cloud API
  }
}

/**
 * Check if hub supports control commands
 * Cloud mirror is read-only
 */
export function supportsControl(status: ConnectionStatus): boolean {
  return status.mode === 'local' || status.mode === 'remote';
}

/**
 * Get connection quality label
 */
export function getConnectionQuality(
  status: ConnectionStatus,
): 'excellent' | 'good' | 'poor' | 'offline' {
  if (!status.online) {
    return 'offline';
  }

  if (status.mode === 'local') {
    if (status.latency && status.latency < 50) {
      return 'excellent';
    }
    return 'good';
  }

  if (status.mode === 'remote') {
    if (status.latency && status.latency < 200) {
      return 'good';
    }
    return 'poor';
  }

  return 'offline';
}

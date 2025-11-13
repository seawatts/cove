/**
 * Hub Status Badge
 * Shows current hub connection status with visual indicator
 */

'use client';

import { Badge } from '@cove/ui/badge';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@cove/ui/tooltip';
import { useEffect } from 'react';
import {
  type ConnectionMode,
  getConnectionQuality,
  supportsControl,
  useHubConnection,
} from '../lib/hub-connection';

interface HubStatusBadgeProps {
  hubId?: string;
  showDetails?: boolean;
}

/**
 * Get badge variant based on connection mode
 */
function getBadgeVariant(mode: ConnectionMode) {
  switch (mode) {
    case 'local':
      return 'default' as const; // Green
    case 'remote':
      return 'secondary' as const; // Yellow
    case 'cloud':
      return 'outline' as const; // Gray
    case 'offline':
      return 'destructive' as const; // Red
  }
}

/**
 * Get icon for connection mode
 */
function getConnectionIcon(mode: ConnectionMode) {
  switch (mode) {
    case 'local':
      return <Icons.Wifi size="xs" />;
    case 'remote':
      return <Icons.Cloud size="xs" />;
    case 'cloud':
      return <Icons.CloudOff size="xs" />;
    case 'offline':
      return <Icons.WifiOff size="xs" />;
  }
}

/**
 * Get human-readable connection label
 */
function getConnectionLabel(mode: ConnectionMode): string {
  switch (mode) {
    case 'local':
      return 'Local';
    case 'remote':
      return 'Remote';
    case 'cloud':
      return 'Cloud Mirror';
    case 'offline':
      return 'Offline';
  }
}

/**
 * Get detailed connection description
 */
function getConnectionDescription(
  mode: ConnectionMode,
  latency: number | null,
): string {
  switch (mode) {
    case 'local':
      return `Connected directly to hub on local network${latency ? ` (${latency}ms)` : ''}. Real-time control available.`;
    case 'remote':
      return `Connected to hub via CloudFlare Tunnel${latency ? ` (${latency}ms)` : ''}. Real-time control available.`;
    case 'cloud':
      return 'Hub unreachable. Viewing last synced state from cloud. Control disabled.';
    case 'offline':
      return 'No connection available. Unable to view or control devices.';
  }
}

export function HubStatusBadge({
  hubId,
  showDetails = false,
}: HubStatusBadgeProps) {
  const { status, isChecking, checkConnection } = useHubConnection();

  // Check connection periodically
  useEffect(() => {
    if (hubId) {
      checkConnection(hubId);

      // Recheck every 30 seconds
      const interval = setInterval(() => {
        checkConnection(hubId);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [hubId, checkConnection]);

  const quality = getConnectionQuality(status);
  const canControl = supportsControl(status);

  if (!hubId) {
    return null;
  }

  const badge = (
    <Badge
      className="flex items-center gap-1 font-normal"
      variant={getBadgeVariant(status.mode)}
    >
      {isChecking ? (
        <Icons.Spinner className="animate-spin" size="xs" />
      ) : (
        getConnectionIcon(status.mode)
      )}
      <span>{getConnectionLabel(status.mode)}</span>
      {status.latency && status.latency < 1000 && (
        <Text className="text-xs opacity-70" variant="muted">
          {status.latency}ms
        </Text>
      )}
    </Badge>
  );

  if (!showDetails) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="grid gap-2">
            <div>
              <Text className="font-semibold" variant="muted">
                Connection Status
              </Text>
              <Text className="text-sm">
                {getConnectionDescription(status.mode, status.latency)}
              </Text>
            </div>

            {!canControl && (
              <div className="rounded bg-amber-500/10 p-2">
                <Text className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Control commands disabled - hub not reachable
                </Text>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <Text className="font-medium" variant="muted">
                  Quality
                </Text>
                <Text className="capitalize">{quality}</Text>
              </div>
              {status.lastChecked > 0 && (
                <div>
                  <Text className="font-medium" variant="muted">
                    Last Checked
                  </Text>
                  <Text>
                    {new Date(status.lastChecked).toLocaleTimeString()}
                  </Text>
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

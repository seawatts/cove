'use client';

import { getAlertSeverityColor, getAlertSeverityLabel } from '@cove/types/alert';
import { AlertCircle, AlertTriangle, Bell, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { useHubWebSocket } from '~/hooks/use-hub-websocket';

interface AlertEvent {
  alertId: string;
  configId: string;
  entityId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold?: number;
  triggeredAt: string;
}

export function AlertNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleAlertTriggered = React.useCallback((data: unknown) => {
    const event = data as AlertEvent;

    const getSeverityIcon = (severity: string) => {
      switch (severity) {
        case 'info':
          return Bell;
        case 'warning':
          return AlertTriangle;
        case 'critical':
          return AlertCircle;
        default:
          return Bell;
      }
    };

    const Icon = getSeverityIcon(event.severity);
    const color = getAlertSeverityColor(event.severity);
    const label = getAlertSeverityLabel(event.severity);

    // Show toast notification with appropriate styling
    if (event.severity === 'critical') {
      toast.error(
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color }} />
          <div className="flex-1 space-y-1">
            <div className="font-semibold">{label} Alert</div>
            <div className="text-sm">{event.message}</div>
            <div className="text-xs text-muted-foreground">
              Value: {event.value}
              {event.threshold && ` (Threshold: ${event.threshold})`}
            </div>
          </div>
        </div>,
        {
          duration: 10000,
          action: {
            label: 'View',
            onClick: () => {
              // Navigate to entity details - we'd need to get device ID from entity
              // For now, just dismiss
            },
          },
        }
      );
    } else if (event.severity === 'warning') {
      toast.warning(
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color }} />
          <div className="flex-1 space-y-1">
            <div className="font-semibold">{label} Alert</div>
            <div className="text-sm">{event.message}</div>
            <div className="text-xs text-muted-foreground">
              Value: {event.value}
              {event.threshold && ` (Threshold: ${event.threshold})`}
            </div>
          </div>
        </div>,
        {
          duration: 8000,
        }
      );
    } else {
      toast.info(
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color }} />
          <div className="flex-1 space-y-1">
            <div className="font-semibold">{label} Alert</div>
            <div className="text-sm">{event.message}</div>
            <div className="text-xs text-muted-foreground">
              Value: {event.value}
              {event.threshold && ` (Threshold: ${event.threshold})`}
            </div>
          </div>
        </div>,
        {
          duration: 6000,
        }
      );
    }
  }, [router]);

  const handleAlertResolved = React.useCallback((data: unknown) => {
    const event = data as AlertEvent;

    toast.success(
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
        <div className="flex-1 space-y-1">
          <div className="font-semibold">Alert Resolved</div>
          <div className="text-sm">{event.message}</div>
        </div>
      </div>,
      {
        duration: 5000,
      }
    );
  }, []);

  const { isConnected } = useHubWebSocket({
    onAlertTriggered: handleAlertTriggered,
    onAlertResolved: handleAlertResolved,
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
  });

  // Optionally show connection status (could be a small indicator)
  React.useEffect(() => {
    if (!isConnected) {
      console.log('Alert notifications: Disconnected from hub');
    } else {
      console.log('Alert notifications: Connected to hub');
    }
  }, [isConnected]);

  return <>{children}</>;
}


'use client';

import { hubApi } from '@cove/api/hub/react';
import type { AlertSeverity } from '@cove/types/alert';
import {
  getAlertSeverityColor,
  getAlertSeverityLabel,
} from '@cove/types/alert';
import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cove/ui/card';
import { ScrollArea } from '@cove/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cove/ui/select';
import { Separator } from '@cove/ui/separator';
import { toast } from '@cove/ui/sonner';
import { Switch } from '@cove/ui/switch';
import { cn } from '@cove/ui/utils';
import { format } from 'date-fns';
import { AlertCircle, AlertTriangle, Bell, Check } from 'lucide-react';
import * as React from 'react';

interface AlertHistoryPanelProps {
  entityId: string;
  className?: string;
}

export function AlertHistoryPanel({
  entityId,
  className,
}: AlertHistoryPanelProps) {
  const [showUnacknowledged, setShowUnacknowledged] = React.useState(false);
  const [showUnresolved, setShowUnresolved] = React.useState(false);
  const [severityFilter, setSeverityFilter] = React.useState<string>('all');

  const utils = hubApi.useUtils();

  // Fetch alert history
  const { data: alertHistory = [], isLoading } =
    hubApi.alerts.getHistory.useQuery({
      entityId,
      limit: 100,
      unacknowledged: showUnacknowledged || undefined,
      unresolved: showUnresolved || undefined,
    });

  // Acknowledge mutation
  const acknowledgeMutation = hubApi.alerts.acknowledge.useMutation({
    onError: (error) => {
      toast.error('Failed to acknowledge alert', {
        description: error.message,
      });
    },
    onSuccess: () => {
      toast.success('Alert acknowledged');
      utils.alerts.getHistory.invalidate({ entityId });
    },
  });

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeMutation.mutateAsync({ alertId });
  };

  // Filter by severity on the client side
  const filteredHistory = React.useMemo(() => {
    if (severityFilter === 'all') {
      return alertHistory;
    }
    return alertHistory.filter((event) => event.severity === severityFilter);
  }, [alertHistory, severityFilter]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'level1':
      case 'level2':
      case 'level3':
        return Bell;
      case 'level4':
        return AlertTriangle;
      case 'level5':
        return AlertCircle;
      default:
        return Bell;
    }
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>Alert History</CardTitle>
        <CardDescription>Recent alert events for this entity</CardDescription>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={showUnacknowledged}
              id="unacknowledged"
              onCheckedChange={setShowUnacknowledged}
            />
            <label className="text-sm cursor-pointer" htmlFor="unacknowledged">
              Unacknowledged only
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={showUnresolved}
              id="unresolved"
              onCheckedChange={setShowUnresolved}
            />
            <label className="text-sm cursor-pointer" htmlFor="unresolved">
              Unresolved only
            </label>
          </div>

          <Select onValueChange={setSeverityFilter} value={severityFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="level1">Level 1 - Excellent</SelectItem>
              <SelectItem value="level2">Level 2 - Good</SelectItem>
              <SelectItem value="level3">Level 3 - Normal</SelectItem>
              <SelectItem value="level4">Level 4 - Warning</SelectItem>
              <SelectItem value="level5">Level 5 - Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading alert history...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No alerts to display</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((event, index) => {
                const Icon = getSeverityIcon(event.severity);
                const color = getAlertSeverityColor(
                  event.severity as AlertSeverity,
                );
                const isResolved = Boolean(event.resolvedAt);

                return (
                  <React.Fragment key={event.id}>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="p-2 rounded-full flex-shrink-0 mt-1"
                          style={{
                            backgroundColor: color
                              .replace('hsl(', 'hsla(')
                              .replace(')', ', 0.1)'),
                          }}
                        >
                          <Icon className="h-4 w-4" style={{ color }} />
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  style={{
                                    borderColor: color,
                                    color: color,
                                  }}
                                  variant="outline"
                                >
                                  {getAlertSeverityLabel(
                                    event.severity as
                                      | 'info'
                                      | 'warning'
                                      | 'critical',
                                  )}
                                </Badge>
                                {isResolved && (
                                  <Badge variant="secondary">Resolved</Badge>
                                )}
                                {event.acknowledged && (
                                  <Badge className="gap-1" variant="outline">
                                    <Check className="h-3 w-3" />
                                    Acknowledged
                                  </Badge>
                                )}
                              </div>

                              <p className="text-sm">{event.message}</p>

                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>
                                  Triggered:{' '}
                                  {format(
                                    new Date(event.triggeredAt),
                                    'MMM dd, yyyy HH:mm:ss',
                                  )}
                                </div>
                                {isResolved && event.resolvedAt && (
                                  <div>
                                    Resolved:{' '}
                                    {format(
                                      new Date(event.resolvedAt),
                                      'MMM dd, yyyy HH:mm:ss',
                                    )}
                                  </div>
                                )}
                                <div>
                                  Value:{' '}
                                  <span className="font-mono">
                                    {event.value}
                                  </span>
                                  {event.threshold && (
                                    <>
                                      {' '}
                                      • Threshold:{' '}
                                      <span className="font-mono">
                                        {event.threshold}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {!event.acknowledged && (
                              <Button
                                disabled={acknowledgeMutation.isPending}
                                onClick={() => handleAcknowledge(event.id)}
                                size="sm"
                                variant="outline"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Acknowledge
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {index < filteredHistory.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

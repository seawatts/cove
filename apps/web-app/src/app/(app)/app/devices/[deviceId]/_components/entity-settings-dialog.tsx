'use client';

import { hubApi } from '@cove/api/hub/react';
import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
import type { AlertConfig, AlertSeverity, AlertType } from '@cove/types/alert';
import {
  getAlertSeverityColor,
  getAlertSeverityLabel,
  getAlertTypeLabel,
} from '@cove/types/alert';
import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import { Text } from '@cove/ui/custom/typography';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@cove/ui/dialog';
import { Input } from '@cove/ui/input';
import { Label } from '@cove/ui/label';
import { ScrollArea } from '@cove/ui/scroll-area';
import { Separator } from '@cove/ui/separator';
import { Switch } from '@cove/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cove/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@cove/ui/tabs';
import { getEntityDisplayName } from '@cove/utils';
import { Edit, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AlertConfigForm } from './alert-config-form';

interface EntitySettingsDialogProps {
  entity: EntityWithStateAndCapabilities;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EntitySettingsDialog({
  entity,
  open,
  onOpenChange,
}: EntitySettingsDialogProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(entity.displayName || '');
  const [isFavorite, setIsFavorite] = useState(entity.isFavorite || false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertConfig | null>(null);
  const [showAlertForm, setShowAlertForm] = useState(false);

  const utils = hubApi.useUtils();

  // Get home ID from hub
  const { data: home } = hubApi.home.get.useQuery();

  // Fetch actual telemetry fields from database
  const { data: telemetryFields = [], isLoading: isLoadingFields } =
    hubApi.telemetry.getFields.useQuery(
      { entityId: entity.id },
      { enabled: open },
    );

  const updateEntity = hubApi.entity.update.useMutation({
    onError: (error) => {
      toast.error(`Failed to update entity: ${error.message}`);
      setIsSaving(false);
      // Invalidate to refetch and get the correct state
      utils.device.getEntities.invalidate({ deviceId: entity.deviceId });
    },
    onMutate: async ({ entityId, displayName, isFavorite }) => {
      // Cancel any outgoing refetches
      await utils.device.getEntities.cancel({ deviceId: entity.deviceId });

      // Snapshot the previous value
      const previousEntities = utils.device.getEntities.getData({
        deviceId: entity.deviceId,
      });

      // Optimistically update the cache
      utils.device.getEntities.setData({ deviceId: entity.deviceId }, (old) => {
        if (!old) return old;
        return old.map((e) => {
          if (e.id === entityId) {
            return {
              ...e,
              ...(displayName !== undefined && { displayName }),
              ...(isFavorite !== undefined && { isFavorite }),
            };
          }
          return e;
        });
      });

      return { previousEntities };
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.device.getEntities.invalidate({ deviceId: entity.deviceId });
      router.refresh();
      setIsSaving(false);
    },
    onSuccess: () => {
      toast.success('Entity settings updated');
      onOpenChange(false);
    },
  });

  const handleSave = () => {
    setIsSaving(true);
    updateEntity.mutate({
      displayName: displayName.trim() || undefined,
      entityId: entity.id,
      isFavorite,
    });
  };

  // Use telemetry fields from database, fallback to capability keys if none exist
  const availableFields =
    telemetryFields.length > 0
      ? telemetryFields
      : Array.from(
          new Set(
            entity.capabilities
              .flatMap((cap) => Object.keys(cap))
              .filter((key) => !['type', 'action', 'command'].includes(key)),
          ),
        );

  // Fetch alert configs
  const { data: alertConfigs = [], isLoading: isLoadingAlerts } =
    hubApi.alerts.list.useQuery({ entityId: entity.id }, { enabled: open });

  // Alert mutations
  const createAlertMutation = hubApi.alerts.create.useMutation({
    onError: (error) => {
      toast.error('Failed to create alert', {
        description: error.message,
      });
    },
    onSuccess: () => {
      toast.success('Alert created successfully');
      utils.alerts.list.invalidate({ entityId: entity.id });
      setShowAlertForm(false);
      setEditingAlert(null);
    },
  });

  const updateAlertMutation = hubApi.alerts.update.useMutation({
    onError: (error) => {
      toast.error('Failed to update alert', {
        description: error.message,
      });
    },
    onSuccess: () => {
      toast.success('Alert updated successfully');
      utils.alerts.list.invalidate({ entityId: entity.id });
      setShowAlertForm(false);
      setEditingAlert(null);
    },
  });

  const deleteAlertMutation = hubApi.alerts.delete.useMutation({
    onError: (error) => {
      toast.error('Failed to delete alert', {
        description: error.message,
      });
    },
    onSuccess: () => {
      toast.success('Alert deleted successfully');
      utils.alerts.list.invalidate({ entityId: entity.id });
    },
  });

  const handleAlertSubmit = async (data: Partial<AlertConfig>) => {
    if (!home?.id) {
      toast.error('Home ID not available. Please try again.');
      return;
    }

    if (editingAlert) {
      await updateAlertMutation.mutateAsync({
        id: editingAlert.id,
        ...data,
      });
    } else {
      await createAlertMutation.mutateAsync({
        entityId: entity.id,
        homeId: home.id,
        ...data,
      } as AlertConfig);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      await deleteAlertMutation.mutateAsync({ id });
    }
  };

  const handleToggleVisibility = async (
    alert: AlertConfig,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    try {
      await updateAlertMutation.mutateAsync({
        id: alert.id,
        showInGraph: !alert.showInGraph,
      });
      toast.success(
        alert.showInGraph
          ? 'Alert hidden from graph'
          : 'Alert visible on graph',
      );
    } catch (error) {
      // Error already handled by mutation's onError
      console.error(error);
    }
  };

  const handleEditAlert = (alert: AlertConfig) => {
    setEditingAlert(alert);
    setShowAlertForm(true);
  };

  const handleNewAlert = () => {
    setEditingAlert(null);
    setShowAlertForm(true);
  };

  const handleCancelAlert = () => {
    setShowAlertForm(false);
    setEditingAlert(null);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Entity Settings</DialogTitle>
          <DialogDescription>
            Configure settings for {entity.key}
          </DialogDescription>
        </DialogHeader>

        <Tabs className="w-full" defaultValue="display">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts
              {alertConfigs.length > 0 && (
                <Badge className="ml-2" variant="secondary">
                  {alertConfigs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="view">View Type</TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-4" value="display">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={getEntityDisplayName({
                  deviceClass: entity.deviceClass,
                  displayName: entity.displayName,
                  key: entity.key || '',
                  name: entity.name || '',
                })}
                value={displayName}
              />
              <Text className="text-xs text-muted-foreground">
                Custom name to display for this entity. Leave empty to use the
                default name from the device.
              </Text>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="favorite">Favorite</Label>
                  <Text className="text-xs text-muted-foreground">
                    Mark as favorite to pin this entity to the top of the device
                    page
                  </Text>
                </div>
                <Switch
                  checked={isFavorite}
                  id="favorite"
                  onCheckedChange={setIsFavorite}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button onClick={() => onOpenChange(false)} variant="outline">
                Cancel
              </Button>
              <Button disabled={isSaving} onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="config">
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Entity ID</TableCell>
                    <TableCell className="font-mono text-xs">
                      {entity.id}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Key</TableCell>
                    <TableCell className="font-mono text-xs">
                      {entity.key}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Kind</TableCell>
                    <TableCell className="capitalize">{entity.kind}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Device Class</TableCell>
                    <TableCell>
                      {entity.deviceClass || (
                        <Text className="text-muted-foreground">N/A</Text>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Name</TableCell>
                    <TableCell>
                      {entity.name || (
                        <Text className="text-muted-foreground">N/A</Text>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Display Name</TableCell>
                    <TableCell>
                      {entity.displayName || (
                        <Text className="text-muted-foreground">N/A</Text>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Current State</TableCell>
                    <TableCell className="font-mono text-xs">
                      {entity.currentState?.state || 'unknown'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Capabilities</TableCell>
                    <TableCell>
                      <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                        {JSON.stringify(entity.capabilities, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                  {entity.currentState?.attrs &&
                    Object.keys(entity.currentState.attrs).length > 0 && (
                      <TableRow>
                        <TableCell className="font-medium">
                          Attributes
                        </TableCell>
                        <TableCell>
                          <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                            {JSON.stringify(entity.currentState.attrs, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent className="space-y-4" value="alerts">
            {isLoadingFields ? (
              <div className="flex items-center justify-center py-8">
                <Text className="text-muted-foreground">
                  Loading available fields...
                </Text>
              </div>
            ) : availableFields.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Text className="text-muted-foreground">
                  No telemetry fields found
                </Text>
                <Text className="text-xs text-muted-foreground mt-2">
                  This entity needs to report telemetry data before alerts can
                  be configured
                </Text>
              </div>
            ) : showAlertForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Text className="font-medium">
                    {editingAlert ? 'Edit Alert' : 'New Alert'}
                  </Text>
                  <Button onClick={handleCancelAlert} size="sm" variant="ghost">
                    Cancel
                  </Button>
                </div>
                <AlertConfigForm
                  availableFields={availableFields}
                  entityId={entity.id}
                  homeId={home?.id || ''}
                  initialData={editingAlert || undefined}
                  onCancel={handleCancelAlert}
                  onSubmit={handleAlertSubmit}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Text className="text-sm text-muted-foreground">
                      Configure alerts to get notified when values cross
                      thresholds
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Available fields: {availableFields.join(', ')}
                    </Text>
                  </div>
                  <Button onClick={handleNewAlert} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Alert
                  </Button>
                </div>

                <ScrollArea className="h-[400px] pr-4">
                  {isLoadingAlerts ? (
                    <div className="flex items-center justify-center py-8">
                      <Text className="text-muted-foreground">
                        Loading alerts...
                      </Text>
                    </div>
                  ) : alertConfigs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Text className="text-muted-foreground">
                        No alerts configured yet
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-2">
                        Create an alert to monitor sensor values
                      </Text>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alertConfigs.map((alert) => (
                        <div
                          className="border rounded-lg p-4 space-y-2"
                          key={alert.id}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <Text className="font-medium">
                                  {alert.name}
                                </Text>
                                <Badge
                                  style={{
                                    backgroundColor: getAlertSeverityColor(
                                      alert.severity as AlertSeverity,
                                    ),
                                  }}
                                >
                                  {getAlertSeverityLabel(
                                    alert.severity as AlertSeverity,
                                  )}
                                </Badge>
                                {!alert.enabled && (
                                  <Badge variant="outline">Disabled</Badge>
                                )}
                              </div>
                              <Text className="text-sm text-muted-foreground">
                                {getAlertTypeLabel(
                                  alert.alertType as AlertType,
                                )}{' '}
                                • Field: {alert.field}
                              </Text>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                onClick={(e) =>
                                  handleToggleVisibility(
                                    alert as AlertConfig,
                                    e,
                                  )
                                }
                                size="sm"
                                title={
                                  alert.showInGraph
                                    ? 'Hide from graph'
                                    : 'Show on graph'
                                }
                                variant="ghost"
                              >
                                {alert.showInGraph ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                              <Button
                                onClick={() =>
                                  handleEditAlert(alert as AlertConfig)
                                }
                                size="sm"
                                variant="ghost"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteAlert(alert.id)}
                                size="sm"
                                variant="ghost"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Show alert configuration details */}
                          <Separator />
                          <div className="text-sm">
                            {alert.alertType === 'threshold' && (
                              <Text className="text-muted-foreground">
                                Trigger when {alert.field}{' '}
                                {alert.thresholdOperator === 'gt'
                                  ? '>'
                                  : alert.thresholdOperator === 'lt'
                                    ? '<'
                                    : alert.thresholdOperator === 'gte'
                                      ? '≥'
                                      : '≤'}{' '}
                                {alert.thresholdValue}
                              </Text>
                            )}
                            {alert.alertType === 'range' && (
                              <Text className="text-muted-foreground">
                                Trigger when {alert.field} outside{' '}
                                {alert.rangeMin} - {alert.rangeMax}
                              </Text>
                            )}
                            {alert.alertType === 'rate_of_change' && (
                              <Text className="text-muted-foreground">
                                Trigger when {alert.field} changes by &gt;{' '}
                                {alert.rateThreshold} per{' '}
                                {alert.rateWindow ? alert.rateWindow / 1000 : 0}
                                s
                              </Text>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </TabsContent>

          <TabsContent value="view">
            <div className="space-y-4">
              <Text className="text-sm text-muted-foreground">
                View type preference coming soon. This will control how entities
                are displayed across the app.
              </Text>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

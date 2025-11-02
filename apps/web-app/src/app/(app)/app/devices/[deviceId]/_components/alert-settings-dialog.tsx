'use client';

import type { AlertConfig } from '@cove/types/alert';
import {
  getAlertSeverityColor,
  getAlertSeverityLabel,
  getAlertTypeLabel,
} from '@cove/types/alert';
import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@cove/ui/dialog';
import { ScrollArea } from '@cove/ui/scroll-area';
import { Separator } from '@cove/ui/separator';
import { toast } from '@cove/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@cove/ui/tabs';
import { Bell, Edit, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { hubApi } from '~/lib/hub-trpc/client';
import { AlertConfigForm } from './alert-config-form';

interface AlertSettingsDialogProps {
  entityId: string;
  homeId: string;
  entityName: string;
  availableFields: string[];
}

export function AlertSettingsDialog({
  entityId,
  homeId,
  entityName,
  availableFields,
}: AlertSettingsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [editingAlert, setEditingAlert] = React.useState<AlertConfig | null>(
    null,
  );
  const [showForm, setShowForm] = React.useState(false);

  const utils = hubApi.useUtils();

  // Fetch alert configs
  const { data: alertConfigs = [], isLoading } = hubApi.alerts.list.useQuery(
    { entityId },
    { enabled: open },
  );

  // Mutations
  const createMutation = hubApi.alerts.create.useMutation({
    onError: (error) => {
      toast.error('Failed to create alert', {
        description: error.message,
      });
    },
    onSuccess: () => {
      toast.success('Alert created successfully');
      utils.alerts.list.invalidate({ entityId });
      setShowForm(false);
      setEditingAlert(null);
    },
  });

  const updateMutation = hubApi.alerts.update.useMutation({
    onError: (error) => {
      toast.error('Failed to update alert', {
        description: error.message,
      });
    },
    onSuccess: () => {
      toast.success('Alert updated successfully');
      utils.alerts.list.invalidate({ entityId });
      setShowForm(false);
      setEditingAlert(null);
    },
  });

  const deleteMutation = hubApi.alerts.delete.useMutation({
    onError: (error) => {
      toast.error('Failed to delete alert', {
        description: error.message,
      });
    },
    onSuccess: () => {
      toast.success('Alert deleted successfully');
      utils.alerts.list.invalidate({ entityId });
    },
  });

  const handleSubmit = async (data: Partial<AlertConfig>) => {
    if (editingAlert) {
      await updateMutation.mutateAsync({
        id: editingAlert.id,
        ...data,
      });
    } else {
      await createMutation.mutateAsync({
        entityId,
        homeId,
        ...data,
      } as AlertConfig);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  const handleEdit = (alert: AlertConfig) => {
    setEditingAlert(alert);
    setShowForm(true);
  };

  const handleNewAlert = () => {
    setEditingAlert(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAlert(null);
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Bell className="h-4 w-4 mr-2" />
          Alerts
          {alertConfigs.length > 0 && (
            <Badge className="ml-2" variant="secondary">
              {alertConfigs.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Alert Settings</DialogTitle>
          <DialogDescription>
            Configure alerts for {entityName}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="list" value={showForm ? 'form' : 'list'}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger onClick={() => setShowForm(false)} value="list">
              Alert List
            </TabsTrigger>
            <TabsTrigger onClick={handleNewAlert} value="form">
              {editingAlert ? 'Edit Alert' : 'New Alert'}
            </TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-4" value="list">
            <ScrollArea className="h-[500px] pr-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading alerts...
                </div>
              ) : alertConfigs.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground mb-4">
                    No alerts configured yet
                  </p>
                  <Button onClick={handleNewAlert}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Alert
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertConfigs.map((alert) => (
                    <div
                      className="border rounded-lg p-4 space-y-3"
                      key={alert.id}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{alert.name}</h4>
                            <Badge
                              style={{
                                borderColor: getAlertSeverityColor(
                                  alert.severity as
                                    | 'info'
                                    | 'warning'
                                    | 'critical',
                                ),
                                color: getAlertSeverityColor(
                                  alert.severity as
                                    | 'info'
                                    | 'warning'
                                    | 'critical',
                                ),
                              }}
                              variant="outline"
                            >
                              {getAlertSeverityLabel(
                                alert.severity as
                                  | 'info'
                                  | 'warning'
                                  | 'critical',
                              )}
                            </Badge>
                            {!alert.enabled && (
                              <Badge variant="secondary">Disabled</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {getAlertTypeLabel(
                              alert.alertType as
                                | 'threshold'
                                | 'range'
                                | 'rate_of_change',
                            )}{' '}
                            • Field: {alert.field}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEdit(alert as AlertConfig)}
                            size="sm"
                            variant="ghost"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(alert.id)}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="text-sm space-y-1">
                        {alert.alertType === 'threshold' && (
                          <p>
                            Trigger when value{' '}
                            {alert.thresholdOperator === 'gt'
                              ? '>'
                              : alert.thresholdOperator === 'lt'
                                ? '<'
                                : alert.thresholdOperator === 'gte'
                                  ? '≥'
                                  : '≤'}{' '}
                            <span className="font-semibold">
                              {alert.thresholdValue}
                            </span>
                          </p>
                        )}
                        {alert.alertType === 'range' && (
                          <p>
                            Trigger when value is outside range{' '}
                            <span className="font-semibold">
                              [{alert.rangeMin}, {alert.rangeMax}]
                            </span>
                          </p>
                        )}
                        {alert.alertType === 'rate_of_change' && (
                          <p>
                            Trigger when rate exceeds{' '}
                            <span className="font-semibold">
                              {alert.rateThreshold}/s
                            </span>{' '}
                            over {alert.rateWindow}ms
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="form">
            <ScrollArea className="h-[500px] pr-4">
              <AlertConfigForm
                availableFields={availableFields}
                entityId={entityId}
                homeId={homeId}
                initialData={editingAlert || undefined}
                onCancel={handleCancel}
                onSubmit={handleSubmit}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

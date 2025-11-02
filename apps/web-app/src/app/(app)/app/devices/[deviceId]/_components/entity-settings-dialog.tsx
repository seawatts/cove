'use client';

import { api } from '@cove/api/react';
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
import { useState } from 'react';
import { toast } from 'sonner';

interface EntitySettingsDialogProps {
  entity: {
    entityId: string;
    key: string;
    kind: string;
    deviceClass?: string | null;
    name?: string | null;
    displayName?: string | null;
    capabilities: Array<Record<string, unknown>>;
    currentState?: {
      state: string;
      attrs?: Record<string, unknown>;
      updatedAt: Date;
    } | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EntitySettingsDialog({
  entity,
  open,
  onOpenChange,
}: EntitySettingsDialogProps) {
  const [displayName, setDisplayName] = useState(entity.displayName || '');
  const [isSaving, setIsSaving] = useState(false);

  const updateEntity = api.entity.update.useMutation({
    onError: (error) => {
      toast.error(`Failed to update entity: ${error.message}`);
      setIsSaving(false);
    },
    onSuccess: () => {
      toast.success('Entity display name updated');
      onOpenChange(false);
    },
  });

  const handleSave = () => {
    setIsSaving(true);
    updateEntity.mutate({
      displayName: displayName.trim() || undefined,
      entityId: entity.entityId,
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Entity Settings</DialogTitle>
          <DialogDescription>
            Configure settings for {entity.key}
          </DialogDescription>
        </DialogHeader>

        <Tabs className="w-full" defaultValue="display">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
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
                  key: entity.key,
                  name: entity.name,
                })}
                value={displayName}
              />
              <Text className="text-xs text-muted-foreground">
                Custom name to display for this entity. Leave empty to use the
                default name from the device.
              </Text>
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
                      {entity.entityId}
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

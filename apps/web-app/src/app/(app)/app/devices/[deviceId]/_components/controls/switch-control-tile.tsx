'use client';

import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { getEntityDisplayName } from '@cove/utils';
import { useEffect, useState } from 'react';
import { EntitySettingsDialog } from '../entity-settings-dialog';

interface SwitchControlTileProps {
  deviceId: string;
  entity: {
    entityId: string;
    kind: string;
    key: string;
    deviceClass?: string | null;
    displayName?: string | null;
    name?: string | null;
    capabilities: Array<Record<string, unknown>>;
    currentState?: {
      state: string;
      attrs?: Record<string, unknown>;
      updatedAt: Date;
    } | null;
  };
  showChart?: boolean;
}

export function SwitchControlTile({
  entity,
  showChart = false,
}: SwitchControlTileProps) {
  const [isOn, setIsOn] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize switch state from entity state
  useEffect(() => {
    setIsOn(entity.currentState?.state === 'on');
  }, [entity.currentState?.state]);

  return (
    <>
      <Card className="min-h-[140px] transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`size-3 rounded-full ${isOn ? 'bg-primary' : 'bg-muted'}`}
              />
              <Text className="text-lg font-semibold">
                {getEntityDisplayName({
                  deviceClass: entity.deviceClass,
                  displayName: entity.displayName,
                  key: entity.key,
                  name: entity.name,
                })}
              </Text>
            </div>
            <Button
              onClick={() => setIsSettingsOpen(true)}
              size="sm"
              variant="ghost"
            >
              <Icons.Settings size="sm" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current state display */}
          <div className="text-center">
            <Text className="text-3xl font-bold">{isOn ? 'ON' : 'OFF'}</Text>
            <Text className="text-sm text-muted-foreground">
              {isOn ? 'Switch is active' : 'Switch is inactive'}
            </Text>
          </div>

          {/* Last updated */}
          {entity.currentState?.updatedAt && (
            <Text className="text-xs text-muted-foreground text-center">
              Updated{' '}
              {new Date(entity.currentState.updatedAt).toLocaleTimeString()}
            </Text>
          )}

          {/* Chart placeholder - will be replaced with actual mini-chart */}
          {showChart && (
            <div className="h-16 bg-muted/20 rounded-md flex items-center justify-center">
              <Text className="text-xs text-muted-foreground">
                Mini-chart coming soon
              </Text>
            </div>
          )}
        </CardContent>
      </Card>

      <EntitySettingsDialog
        entity={entity}
        onOpenChange={setIsSettingsOpen}
        open={isSettingsOpen}
      />
    </>
  );
}

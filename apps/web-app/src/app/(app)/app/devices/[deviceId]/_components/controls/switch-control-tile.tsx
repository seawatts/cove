'use client';

import { Card, CardContent, CardHeader } from '@cove/ui/card';
import { Text } from '@cove/ui/custom/typography';
import { Switch } from '@cove/ui/switch';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SwitchControlTileProps {
  deviceId: string;
  entity: {
    entityId: string;
    key: string;
    deviceClass?: string | null;
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

  // Initialize switch state from entity state
  useEffect(() => {
    setIsOn(entity.currentState?.state === 'on');
  }, [entity.currentState]);

  const handleToggle = async () => {
    const newState = !isOn;
    setIsOn(newState);
    toast.info(`${entity.key} command disabled - device control coming soon`);
  };

  return (
    <Card className="min-h-[140px] transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`size-3 rounded-full ${isOn ? 'bg-primary' : 'bg-muted'}`}
            />
            <Text className="text-lg font-semibold">{entity.key}</Text>
          </div>
          <Switch
            checked={isOn}
            disabled={true}
            onCheckedChange={handleToggle}
          />
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
  );
}

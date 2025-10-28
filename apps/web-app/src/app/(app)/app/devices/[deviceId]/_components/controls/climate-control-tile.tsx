'use client';

import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader } from '@cove/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@cove/ui/collapsible';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { Label } from '@cove/ui/label';
import { Slider } from '@cove/ui/slider';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ClimateControlTileProps {
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

interface ClimateState {
  temperature: number;
  targetTemperature: number;
  mode: string;
  fanMode?: string;
}

export function ClimateControlTile({
  entity,
  showChart = false,
}: ClimateControlTileProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [climateState, setClimateState] = useState<ClimateState>({
    fanMode: 'auto',
    mode: 'heat',
    targetTemperature: 22,
    temperature: 20,
  });

  // Initialize climate state from current values
  useEffect(() => {
    const attrs = entity.currentState?.attrs || {};
    setClimateState({
      fanMode: (attrs.fan_mode as string) || 'auto',
      mode: (attrs.hvac_mode as string) || 'heat',
      targetTemperature: (attrs.temperature as number) || 22,
      temperature: (attrs.current_temperature as number) || 20,
    });
  }, [entity.currentState]);

  const handleTemperatureChange = async (temp: number) => {
    setClimateState((prev) => ({ ...prev, targetTemperature: temp }));
    toast.info(
      `${entity.key} temperature command disabled - device control coming soon`,
    );
  };

  const handleModeChange = async (mode: string) => {
    setClimateState((prev) => ({ ...prev, mode }));
    toast.info(
      `${entity.key} mode command disabled - device control coming soon`,
    );
  };

  const supportsFan = entity.capabilities.some((c) => c.type === 'fan_mode');

  const supportsMode = entity.capabilities.some((c) => c.type === 'hvac_mode');

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'heat':
        return <Icons.Flame size="sm" />;
      case 'cool':
        return <Icons.SunMedium size="sm" />;
      case 'auto':
        return <Icons.ArrowUpDown size="sm" />;
      case 'off':
        return <Icons.X size="sm" />;
      default:
        return <Icons.Flame size="sm" />;
    }
  };

  return (
    <Card className="min-h-[140px] transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-3 rounded-full bg-primary" />
            <Text className="text-lg font-semibold">{entity.key}</Text>
          </div>
          <div className="flex items-center gap-2">
            {getModeIcon(climateState.mode)}
            <Text className="text-sm capitalize">{climateState.mode}</Text>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current temperature display */}
        <div className="text-center">
          <Text className="text-3xl font-bold">
            {Math.round(climateState.temperature)}°
          </Text>
          <Text className="text-sm text-muted-foreground">
            Target: {Math.round(climateState.targetTemperature)}°
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

        {/* Expandable controls */}
        <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
          <CollapsibleTrigger asChild>
            <Button className="w-full" size="sm" variant="ghost">
              <Text className="text-sm">Temperature Control</Text>
              <ChevronDown
                className={`ml-2 size-4 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            {/* Temperature slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Target Temperature</Label>
                <Text className="text-sm text-muted-foreground">
                  {Math.round(climateState.targetTemperature)}°
                </Text>
              </div>
              <Slider
                disabled={true}
                max={30}
                min={16}
                onValueChange={([temp]) =>
                  temp !== undefined && handleTemperatureChange(temp)
                }
                step={0.5}
                value={[climateState.targetTemperature]}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>16°</span>
                <span>30°</span>
              </div>
            </div>

            {/* Mode controls */}
            {supportsMode && (
              <div className="space-y-2">
                <Label className="text-sm">Mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    disabled
                    onClick={() => handleModeChange('heat')}
                    size="sm"
                    variant={
                      climateState.mode === 'heat' ? 'default' : 'outline'
                    }
                  >
                    Heat
                  </Button>
                  <Button
                    disabled
                    onClick={() => handleModeChange('cool')}
                    size="sm"
                    variant={
                      climateState.mode === 'cool' ? 'default' : 'outline'
                    }
                  >
                    Cool
                  </Button>
                  <Button
                    disabled
                    onClick={() => handleModeChange('auto')}
                    size="sm"
                    variant={
                      climateState.mode === 'auto' ? 'default' : 'outline'
                    }
                  >
                    Auto
                  </Button>
                  <Button
                    disabled
                    onClick={() => handleModeChange('off')}
                    size="sm"
                    variant={
                      climateState.mode === 'off' ? 'default' : 'outline'
                    }
                  >
                    Off
                  </Button>
                </div>
              </div>
            )}

            {/* Fan controls */}
            {supportsFan && (
              <div className="space-y-2">
                <Label className="text-sm">Fan</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button disabled size="sm" variant="outline">
                    Auto
                  </Button>
                  <Button disabled size="sm" variant="outline">
                    Low
                  </Button>
                  <Button disabled size="sm" variant="outline">
                    High
                  </Button>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

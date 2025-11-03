'use client';

import { hubApi } from '@cove/api/hub/react';
import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
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
import { getEntityDisplayName } from '@cove/utils';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EntitySettingsDialog } from '../entity-settings-dialog';

interface ClimateControlTileProps {
  deviceId: string;
  entity: EntityWithStateAndCapabilities;
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
  deviceId,
}: ClimateControlTileProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(entity.isFavorite || false);
  const [climateState, setClimateState] = useState<ClimateState>({
    fanMode: 'auto',
    mode: 'heat',
    targetTemperature: 22,
    temperature: 20,
  });

  // Memoize the climate attributes to avoid infinite loops
  const climateAttrs = useMemo(() => {
    const attrs = entity.currentState?.attrs || {};
    return {
      fanMode: (attrs.fan_mode as string) || 'auto',
      mode: (attrs.hvac_mode as string) || 'heat',
      targetTemperature: (attrs.temperature as number) || 22,
      temperature: (attrs.current_temperature as number) || 20,
    };
  }, [entity.currentState?.attrs]);

  // Initialize climate state from current values
  useEffect(() => {
    setClimateState(climateAttrs);
  }, [climateAttrs]);

  // Sync favorite state with prop changes
  useEffect(() => {
    setIsFavorite(entity.isFavorite || false);
  }, [entity.isFavorite]);

  // Toggle favorite mutation
  const utils = hubApi.useUtils();
  const toggleFavoriteMutation = hubApi.entity.toggleFavorite.useMutation({
    onError: (
      _err,
      _variables,
      context:
        | {
            previousEntities: Awaited<
              ReturnType<typeof utils.device.getEntities.getData>
            >;
          }
        | undefined,
    ) => {
      // Rollback on error
      if (context?.previousEntities) {
        utils.device.getEntities.setData(
          { deviceId },
          context.previousEntities,
        );
      }
    },
    onMutate: async ({ entityId }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await utils.device.getEntities.cancel({ deviceId });

      // Snapshot the previous value
      const previousEntities = utils.device.getEntities.getData({ deviceId });

      // Optimistically update the cache
      utils.device.getEntities.setData({ deviceId }, (old) => {
        if (!old) return old;
        return old.map((e) =>
          e.id === entityId ? { ...e, isFavorite: !e.isFavorite } : e,
        );
      });

      return { previousEntities };
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.device.getEntities.invalidate({ deviceId });
      router.refresh();
    },
  });

  const handleFavoriteToggle = () => {
    toggleFavoriteMutation.mutate({ entityId: entity.id });
  };

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

  // Climate control specific capabilities would need to be added to the base capability types
  const supportsFan = false; // TODO: Add fan_mode capability type
  const supportsMode = false; // TODO: Add hvac_mode capability type

  return (
    <>
      <Card className="min-h-[140px] transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-3 rounded-full bg-primary" />
              <Text className="text-lg font-semibold">
                {getEntityDisplayName({
                  deviceClass: entity.deviceClass,
                  displayName: entity.displayName,
                  key: entity.key || '',
                  name: entity.name || '',
                })}
              </Text>
            </div>
            <div className="flex gap-1">
              <Button
                onClick={handleFavoriteToggle}
                size="sm"
                title={
                  isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
                variant="ghost"
              >
                <Icons.Star
                  className={
                    isFavorite ? 'fill-yellow-500 text-yellow-500' : ''
                  }
                  size="sm"
                />
              </Button>
              <Button
                onClick={() => setIsSettingsOpen(true)}
                size="sm"
                variant="ghost"
              >
                <Icons.Settings size="sm" />
              </Button>
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

      <EntitySettingsDialog
        entity={entity}
        onOpenChange={setIsSettingsOpen}
        open={isSettingsOpen}
      />
    </>
  );
}

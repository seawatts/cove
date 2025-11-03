'use client';

import { hubApi } from '@cove/api/hub/react';
import { api } from '@cove/api/react';
import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
import { hasCapability } from '@cove/db/hub';
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
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EntitySettingsDialog } from '../entity-settings-dialog';

interface LightControlTileProps {
  deviceId: string;
  entity: EntityWithStateAndCapabilities;
  showChart?: boolean;
}

interface LightState {
  brightness?: number;
  state: boolean;
}

export function LightControlTile({
  entity,
  showChart = false,
  deviceId,
}: LightControlTileProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(entity.isFavorite || false);
  const [lightState, setLightState] = useState<LightState>({
    brightness: 1,
    state: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Initialize light state from current values
  useEffect(() => {
    const isOn = entity.currentState?.state === 'on';
    const brightness = (entity.currentState?.attrs?.brightness as number) || 1;
    setLightState({
      brightness: isOn ? brightness : 0,
      state: isOn,
    });
  }, [entity.currentState?.state, entity.currentState?.attrs?.brightness]);

  // Sync favorite state with prop changes
  useEffect(() => {
    setIsFavorite(entity.isFavorite || false);
  }, [entity.isFavorite]);

  // tRPC mutation for sending commands
  const sendCommandMutation = api.entity.sendCommand.useMutation({
    onError: (error) => {
      toast.error(`Failed to control light: ${error.message}`);
      // Revert optimistic update on error
      setLightState((prev) => ({ ...prev, state: !prev.state }));
    },
    onSuccess: () => {
      toast.success(`Light ${lightState.state ? 'turned off' : 'turned on'}`);
    },
  });

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
      // Rollback local state on error
      setIsFavorite((prev) => !prev);
      // Rollback cache on error
      if (context?.previousEntities) {
        utils.device.getEntities.setData(
          { deviceId },
          context.previousEntities,
        );
      }
    },
    onMutate: async ({ entityId }) => {
      // Optimistically update local state immediately
      setIsFavorite((prev) => !prev);

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

  const handleBrightnessChange = async (brightness: number) => {
    const newState = brightness > 0;

    // Optimistic update
    setLightState((prev) => ({
      ...prev,
      brightness,
      state: newState,
    }));
    setIsLoading(true);

    try {
      // Send both brightness and on/off state
      await sendCommandMutation.mutateAsync({
        capability: 'brightness',
        entityId: entity.id,
        value: brightness,
      });

      if (newState !== lightState.state) {
        await sendCommandMutation.mutateAsync({
          capability: 'on_off',
          entityId: entity.id,
          value: newState,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const supportsBrightness = hasCapability(entity, 'brightness');
  const supportsColor =
    hasCapability(entity, 'color') || hasCapability(entity, 'color_temp');

  return (
    <>
      <Card className="min-h-[140px] transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`size-3 rounded-full ${lightState.state ? 'bg-primary' : 'bg-muted'}`}
              />
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
          {/* Current state display */}
          <div className="text-center">
            <Text className="text-3xl font-bold">
              {lightState.state ? 'ON' : 'OFF'}
            </Text>
            {lightState.state && supportsBrightness && (
              <Text className="text-sm text-muted-foreground">
                {Math.round((lightState.brightness || 1) * 100)}% brightness
              </Text>
            )}
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
          {lightState.state && (supportsBrightness || supportsColor) && (
            <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
              <CollapsibleTrigger asChild>
                <Button className="w-full" size="sm" variant="ghost">
                  <Text className="text-sm">Advanced Controls</Text>
                  <ChevronDown
                    className={`ml-2 size-4 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                {supportsBrightness && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Brightness</Label>
                      <Text className="text-sm text-muted-foreground">
                        {Math.round((lightState.brightness || 1) * 100)}%
                      </Text>
                    </div>
                    <Slider
                      disabled={isLoading}
                      max={1}
                      min={0.01}
                      onValueChange={([brightness]) =>
                        brightness !== undefined &&
                        handleBrightnessChange(brightness)
                      }
                      step={0.01}
                      value={[lightState.brightness || 1]}
                    />
                  </div>
                )}

                {supportsColor && (
                  <div className="space-y-2">
                    <Label className="text-sm">Color</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button disabled size="sm" variant="outline">
                        Warm
                      </Button>
                      <Button disabled size="sm" variant="outline">
                        Cool
                      </Button>
                      <Button disabled size="sm" variant="outline">
                        Custom
                      </Button>
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
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

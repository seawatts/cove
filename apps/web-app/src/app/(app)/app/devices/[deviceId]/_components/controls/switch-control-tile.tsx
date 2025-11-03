'use client';

import { hubApi } from '@cove/api/hub/react';
import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { getEntityDisplayName } from '@cove/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EntitySettingsDialog } from '../entity-settings-dialog';

interface SwitchControlTileProps {
  deviceId: string;
  entity: EntityWithStateAndCapabilities;
  showChart?: boolean;
}

export function SwitchControlTile({
  entity,
  showChart = false,
  deviceId,
}: SwitchControlTileProps) {
  const router = useRouter();
  const [isOn, setIsOn] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(entity.isFavorite || false);

  // Initialize switch state from entity state
  useEffect(() => {
    setIsOn(entity.currentState?.state === 'on');
  }, [entity.currentState?.state]);

  // Sync favorite state with prop changes
  useEffect(() => {
    setIsFavorite(entity.isFavorite || false);
  }, [entity.isFavorite]);

  // Toggle favorite mutation
  const utils = hubApi.useUtils();
  const toggleFavoriteMutation = hubApi.entity.toggleFavorite.useMutation({
    onError: (_err, _variables, context) => {
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

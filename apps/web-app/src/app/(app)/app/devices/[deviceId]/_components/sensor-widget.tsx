'use client';

import { hubApi } from '@cove/api/hub/react';
import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
import {
  type SensorMetadata,
  type WidgetProps,
  WidgetType,
} from '@cove/types/widget';
import { Button } from '@cove/ui/button';
import { Icons } from '@cove/ui/custom/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@cove/ui/dropdown-menu';
import { getAvailableWidgetTypes } from '@cove/utils/detect-widget-type';
import { formatSensorValue } from '@cove/utils/format-sensor-value';
import { useRouter } from 'next/navigation';
import { useQueryState } from 'nuqs';
// Lazy load widget components to reduce bundle size
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { timeRangeParser } from '../_lib/query-parsers';
import { EntitySettingsDialog } from './entity-settings-dialog';
import { LazyChartWrapper, useChartVisibility } from './lazy-chart-wrapper';

const ChartWidget = lazy(() =>
  import('./widgets/chart-widget').then((m) => ({ default: m.ChartWidget })),
);
const ValueCardWidget = lazy(() =>
  import('./widgets/value-card-widget').then((m) => ({
    default: m.ValueCardWidget,
  })),
);
const GaugeWidget = lazy(() =>
  import('./widgets/gauge-widget').then((m) => ({ default: m.GaugeWidget })),
);
const RadialWidget = lazy(() =>
  import('./widgets/radial-widget').then((m) => ({ default: m.RadialWidget })),
);
const TableWidget = lazy(() =>
  import('./widgets/table-widget').then((m) => ({ default: m.TableWidget })),
);

interface SensorWidgetProps {
  deviceId: string;
  sensor: SensorMetadata;
  mode?: 'full' | 'embedded';
  entity?: EntityWithStateAndCapabilities;
}

function WidgetTypeSelector({
  currentType,
  availableTypes,
  onChange,
  onEntitySettingsClick,
  onFavoriteToggle,
  isFavorite,
}: {
  currentType: WidgetType;
  availableTypes: WidgetType[];
  onChange: (type: WidgetType) => void;
  onEntitySettingsClick?: () => void;
  onFavoriteToggle?: () => void;
  isFavorite?: boolean;
}) {
  const typeLabels: Record<WidgetType, string> = {
    [WidgetType.Chart]: 'Chart',
    [WidgetType.ValueCard]: 'Value Card',
    [WidgetType.Gauge]: 'Gauge',
    [WidgetType.Table]: 'Table',
    [WidgetType.Radial]: 'Radial',
  };

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-1">
      {onFavoriteToggle && (
        <Button
          onClick={onFavoriteToggle}
          size="sm"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          variant="ghost"
        >
          <Icons.Star
            className={isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}
            size="sm"
          />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            <Icons.LayoutGrid size="sm" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableTypes.map((type) => (
            <DropdownMenuItem
              className={type === currentType ? 'bg-accent' : ''}
              key={type}
              onClick={() => onChange(type)}
            >
              {typeLabels[type]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {onEntitySettingsClick && (
        <Button onClick={onEntitySettingsClick} size="sm" variant="ghost">
          <Icons.Settings size="sm" />
        </Button>
      )}
    </div>
  );
}

const SensorWidgetComponent = ({
  deviceId,
  sensor,
  mode = 'full',
  entity,
}: SensorWidgetProps) => {
  const router = useRouter();
  const [timeRange] = useQueryState('timeRange', timeRangeParser);

  // Check if widget is visible to defer API calls (only works when wrapped in LazyChartWrapper)
  const isVisible = useChartVisibility();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Only fetch data when widget is visible (for full mode wrapped in LazyChartWrapper)
  // For embedded mode, always fetch since it's typically visible immediately
  const shouldFetch = mode === 'embedded' || isVisible;

  const { data: aggregatedData = [] } = hubApi.telemetry.getAggregated.useQuery(
    {
      entityId: sensor.entityId, // Use entityId instead of key
      timeRange,
    },
    {
      enabled: shouldFetch,
      refetchInterval: shouldFetch ? 60000 : false, // 1 minute when enabled, disabled otherwise
      staleTime: 0, // Always use fresh data from polling
    },
  );

  // Use local state for widget preferences instead of backend storage
  const [widgetType, setWidgetType] = useState<WidgetType>(WidgetType.Chart);
  const [isFavorite, setIsFavorite] = useState(entity?.isFavorite || false);

  // Sync favorite state with prop changes
  useEffect(() => {
    setIsFavorite(entity?.isFavorite || false);
  }, [entity?.isFavorite]);

  // Get available widget types for this sensor
  const availableTypes = getAvailableWidgetTypes(sensor.key, sensor.type);

  const handleWidgetTypeChange = (newType: WidgetType) => {
    setWidgetType(newType);
  };

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
    if (entity) {
      toggleFavoriteMutation.mutate({ entityId: entity.id });
    }
  };

  const widgetProps: WidgetProps = {
    config: {}, // No backend config storage
    deviceId,
    sensor,
  };

  // For embedded mode, always show a simple value card or mini chart
  if (mode === 'embedded') {
    return (
      <Suspense
        fallback={<div className="h-16 animate-pulse bg-muted rounded" />}
      >
        {aggregatedData.length > 0 ? (
          <div className="h-16 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-semibold">
                {formatSensorValue(sensor.currentValue, sensor.unit)}
              </div>
              <div className="text-xs text-muted-foreground">
                {aggregatedData.length} data points
              </div>
            </div>
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-semibold">
                {formatSensorValue(sensor.currentValue, sensor.unit)}
              </div>
              <div className="text-xs text-muted-foreground">No history</div>
            </div>
          </div>
        )}
      </Suspense>
    );
  }

  return (
    <>
      <div className="relative">
        <WidgetTypeSelector
          availableTypes={availableTypes}
          currentType={widgetType}
          isFavorite={isFavorite}
          onChange={handleWidgetTypeChange}
          onEntitySettingsClick={
            entity ? () => setIsSettingsOpen(true) : undefined
          }
          onFavoriteToggle={entity ? handleFavoriteToggle : undefined}
        />

        {widgetType === WidgetType.Chart ? (
          <LazyChartWrapper>
            <Suspense
              fallback={
                <div className="h-[250px] animate-pulse bg-muted rounded-lg" />
              }
            >
              <ChartWidget {...widgetProps} />
            </Suspense>
          </LazyChartWrapper>
        ) : (
          <Suspense
            fallback={
              <div className="h-[250px] animate-pulse bg-muted rounded-lg" />
            }
          >
            {widgetType === WidgetType.ValueCard && (
              <ValueCardWidget {...widgetProps} />
            )}
            {widgetType === WidgetType.Gauge && (
              <GaugeWidget {...widgetProps} />
            )}
            {widgetType === WidgetType.Radial && (
              <RadialWidget {...widgetProps} />
            )}
            {widgetType === WidgetType.Table && (
              <TableWidget {...widgetProps} />
            )}
          </Suspense>
        )}
      </div>

      {entity && (
        <EntitySettingsDialog
          entity={entity}
          onOpenChange={setIsSettingsOpen}
          open={isSettingsOpen}
        />
      )}
    </>
  );
};

// Memoize to prevent re-renders when parent components update due to sidebar toggles
export const SensorWidget = React.memo(
  SensorWidgetComponent,
  (prevProps, nextProps) => {
    // Only re-render if the sensor entityId, key, or mode changes
    return (
      prevProps.sensor.entityId === nextProps.sensor.entityId &&
      prevProps.sensor.key === nextProps.sensor.key &&
      prevProps.mode === nextProps.mode &&
      prevProps.deviceId === nextProps.deviceId
    );
  },
);

'use client';

import { api } from '@cove/api/react';
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
import {
  detectWidgetType,
  getAvailableWidgetTypes,
} from '@cove/utils/detect-widget-type';
// Lazy load widget components to reduce bundle size
import { lazy, Suspense } from 'react';

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
}

function WidgetTypeSelector({
  currentType,
  availableTypes,
  onChange,
}: {
  currentType: WidgetType;
  availableTypes: WidgetType[];
  onChange: (type: WidgetType) => void;
}) {
  const typeLabels: Record<WidgetType, string> = {
    [WidgetType.Chart]: 'Chart',
    [WidgetType.ValueCard]: 'Value Card',
    [WidgetType.Gauge]: 'Gauge',
    [WidgetType.Table]: 'Table',
    [WidgetType.Radial]: 'Radial',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="absolute top-2 right-2 z-10"
          size="sm"
          variant="ghost"
        >
          <Icons.Settings size="sm" />
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
  );
}

export function SensorWidget({ deviceId, sensor }: SensorWidgetProps) {
  const utils = api.useUtils();
  const { data: preferences = [] } = api.widget.getPreferences.useQuery({
    deviceId,
  });
  const setPreference = api.widget.setPreference.useMutation({
    onSuccess: () => {
      // Invalidate and refetch preferences after mutation
      utils.widget.getPreferences.invalidate({ deviceId });
    },
  });

  const userPreference = preferences.find((p) => p.sensorKey === sensor.key);
  const { data: stateHistory = [] } = api.entity.getStateHistory.useQuery({
    entityId: sensor.key, // sensor.key is now the entityId
    timeRange: '24h',
  });

  // Determine widget type: user preference > auto-detect
  const widgetType =
    (userPreference?.widgetType as WidgetType) ||
    detectWidgetType(sensor.key, sensor.type, stateHistory.length > 0);

  // Get available widget types for this sensor
  const availableTypes = getAvailableWidgetTypes(
    sensor.key,
    sensor.type,
    stateHistory.length > 0,
  );

  const handleWidgetTypeChange = (newType: WidgetType) => {
    setPreference.mutate({
      deviceId,
      sensorKey: sensor.key,
      widgetType: newType,
    });
  };

  const widgetProps: WidgetProps = {
    config: userPreference?.widgetConfig || {},
    sensor,
  };

  return (
    <div className="relative">
      <WidgetTypeSelector
        availableTypes={availableTypes}
        currentType={widgetType}
        onChange={handleWidgetTypeChange}
      />

      <Suspense
        fallback={
          <div className="h-[250px] animate-pulse bg-muted rounded-lg" />
        }
      >
        {widgetType === WidgetType.Chart && <ChartWidget {...widgetProps} />}
        {widgetType === WidgetType.ValueCard && (
          <ValueCardWidget {...widgetProps} />
        )}
        {widgetType === WidgetType.Gauge && <GaugeWidget {...widgetProps} />}
        {widgetType === WidgetType.Radial && <RadialWidget {...widgetProps} />}
        {widgetType === WidgetType.Table && <TableWidget {...widgetProps} />}
      </Suspense>
    </div>
  );
}

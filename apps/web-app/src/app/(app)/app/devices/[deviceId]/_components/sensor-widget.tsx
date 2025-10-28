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
import { formatSensorValue } from '@cove/utils/format-sensor-value';
import { useQueryState } from 'nuqs';
// Lazy load widget components to reduce bundle size
import { lazy, Suspense, useState } from 'react';

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

export function SensorWidget({
  deviceId,
  sensor,
  mode = 'full',
}: SensorWidgetProps) {
  const [timeRange] = useQueryState('timeRange', {
    defaultValue: '24h',
    parse: (value) => (value as '1h' | '24h' | '7d' | '30d' | '90d') || '24h',
  });

  const { data: aggregatedData = [] } =
    api.graph.getEntityAggregatedData.useQuery({
      entityId: sensor.entityId, // Use entityId instead of key
      timeRange: (timeRange as '1h' | '24h' | '7d' | '30d' | '90d') || '24h',
    });

  // Use local state for widget preferences instead of backend storage
  const [widgetType, setWidgetType] = useState<WidgetType>(
    detectWidgetType(sensor.type),
  );

  // Get available widget types for this sensor
  const availableTypes = getAvailableWidgetTypes(sensor.key, sensor.type);

  const handleWidgetTypeChange = (newType: WidgetType) => {
    setWidgetType(newType);
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

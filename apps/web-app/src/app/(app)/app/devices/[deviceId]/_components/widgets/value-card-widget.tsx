'use client';

import type { WidgetProps } from '@cove/types/widget';
import { Card, CardContent, CardHeader } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { formatSensorValue } from '@cove/utils/format-sensor-value';
import { format } from 'date-fns';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useQueryState } from 'nuqs';
import { useEntityData } from '../hooks/use-entity-data';

interface TrendData {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  timeSpan: string;
}

function TrendIndicator({ trend }: { trend?: TrendData }) {
  if (!trend) return null;

  const { direction, percentage, timeSpan } = trend;

  const iconProps = { className: 'text-muted-foreground', size: 16 };
  const Icon =
    direction === 'up'
      ? TrendingUp
      : direction === 'down'
        ? TrendingDown
        : Minus;

  const colorClass =
    direction === 'up'
      ? 'text-green-600'
      : direction === 'down'
        ? 'text-red-600'
        : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-1 text-sm">
      <Icon {...iconProps} className={colorClass} />
      <span className={colorClass}>{percentage.toFixed(1)}%</span>
      <span className="text-muted-foreground text-xs">vs {timeSpan}</span>
    </div>
  );
}

function calculateStats(
  aggregatedData: Array<{
    timestamp: number;
    mean: number | null;
    min: number | null;
    max: number | null;
  }>,
) {
  if (aggregatedData.length === 0) {
    return { avg: 0, max: 0, min: 0 };
  }

  const validValues = aggregatedData
    .map((d) => d.mean)
    .filter((value): value is number => value !== null && !Number.isNaN(value));

  if (validValues.length === 0) {
    return { avg: 0, max: 0, min: 0 };
  }

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const avg =
    validValues.reduce((sum, value) => sum + value, 0) / validValues.length;

  return { avg, max, min };
}

function calculateTrend(
  _currentValue: number,
  aggregatedData: Array<{ timestamp: number; mean: number | null }>,
): TrendData | undefined {
  if (aggregatedData.length < 2) return undefined;

  // Get values from recent and earlier periods for comparison
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Find closest aggregated values
  const recentData = aggregatedData
    .filter((d) => new Date(d.timestamp) >= oneHourAgo)
    .sort(
      (a, b) =>
        Math.abs(new Date(a.timestamp).getTime() - now.getTime()) -
        Math.abs(new Date(b.timestamp).getTime() - now.getTime()),
    );

  const oldData = aggregatedData
    .filter(
      (d) =>
        new Date(d.timestamp) >= twentyFourHoursAgo &&
        new Date(d.timestamp) < oneHourAgo,
    )
    .sort(
      (a, b) =>
        Math.abs(
          new Date(a.timestamp).getTime() - twentyFourHoursAgo.getTime(),
        ) -
        Math.abs(
          new Date(b.timestamp).getTime() - twentyFourHoursAgo.getTime(),
        ),
    );

  if (recentData.length === 0 || oldData.length === 0) return undefined;

  const recentDataPoint = recentData[0];
  const oldDataPoint = oldData[0];

  if (!recentDataPoint || !oldDataPoint) return undefined;

  const recentValue = recentDataPoint.mean ?? 0;
  const oldValue = oldDataPoint.mean ?? 0;

  if (Number.isNaN(recentValue) || Number.isNaN(oldValue) || oldValue === 0)
    return undefined;

  const percentageChange =
    ((recentValue - oldValue) / Math.abs(oldValue)) * 100;

  let direction: 'up' | 'down' | 'stable';
  if (Math.abs(percentageChange) < 1) {
    direction = 'stable';
  } else {
    direction = percentageChange > 0 ? 'up' : 'down';
  }

  return {
    direction,
    percentage: Math.abs(percentageChange),
    timeSpan: '24h ago',
  };
}

export function ValueCardWidget({ sensor, config }: WidgetProps) {
  const [timeRange] = useQueryState('timeRange', {
    defaultValue: '24h',
    parse: (value) => (value as '1h' | '24h' | '7d' | '30d' | '90d') || '24h',
  });

  // Use the unified data hook with polling only
  const { aggregatedData, status } = useEntityData({
    entityId: sensor.entityId,
    onStateChange: (newState) => {
      console.log('New state received for value card:', newState);
    },
    timeRange: timeRange as '1h' | '24h' | '7d' | '30d' | '90d',
  });

  // Extract unit from sensor metadata
  const unit = sensor.unit;

  const getConnectionStatusIcon = () => {
    switch (status) {
      case 'polling':
        return <Icons.Circle size="sm" variant="primary" />;
      case 'error':
        return <Icons.CircleStop size="sm" variant="destructive" />;
      default:
        return <Icons.CircleStop size="sm" variant="muted" />;
    }
  };

  const getConnectionStatusText = () => {
    switch (status) {
      case 'polling':
        return 'Polling';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  const formattedValue = formatSensorValue(sensor.currentValue, unit);
  const trend = calculateTrend(
    typeof sensor.currentValue === 'number'
      ? sensor.currentValue
      : Number(sensor.currentValue) || 0,
    aggregatedData as Array<{ timestamp: number; mean: number | null }>,
  );

  const stats = calculateStats(
    aggregatedData as Array<{
      timestamp: number;
      mean: number | null;
      min: number | null;
      max: number | null;
    }>,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {sensor.name}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getConnectionStatusIcon()}
            <span>{getConnectionStatusText()}</span>
          </div>
        </div>
        {/* Current Value and Statistics */}
        <div className="flex items-center justify-between mt-3">
          <div className="text-3xl font-light tracking-tight">
            {formattedValue}{' '}
            {unit && (
              <span className="text-lg text-muted-foreground/70 ml-1">
                {unit}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground/70 space-x-6">
            <span>Min {formatSensorValue(stats.min, unit)}</span>
            <span>Max {formatSensorValue(stats.max, unit)}</span>
            <span>Avg {formatSensorValue(stats.avg, unit)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-6">
        {/* Last Updated - Very Subtle */}
        {sensor.lastChanged && (
          <div className="text-xs text-muted-foreground/50 text-center">
            Last updated:{' '}
            {format(new Date(sensor.lastChanged), 'MMM dd, HH:mm')}
          </div>
        )}

        {/* Trend Indicator */}
        {config.showTrend && trend && (
          <div className="mt-4">
            <TrendIndicator trend={trend} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { api } from '@cove/api/react';
import type { WidgetProps } from '@cove/types/widget';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { formatSensorValue } from '@cove/utils/format-sensor-value';
import { format } from 'date-fns';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

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

function calculateTrend(
  _currentValue: number,
  historicalData: Array<{ lastChanged: Date | string; state: unknown }>,
): TrendData | undefined {
  if (historicalData.length < 2) return undefined;

  // Get values from last hour and 24 hours ago for comparison
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Find closest historical values
  const recentData = historicalData
    .filter((d) => new Date(d.lastChanged) >= oneHourAgo)
    .sort(
      (a, b) =>
        Math.abs(new Date(a.lastChanged).getTime() - now.getTime()) -
        Math.abs(new Date(b.lastChanged).getTime() - now.getTime()),
    );

  const oldData = historicalData
    .filter(
      (d) =>
        new Date(d.lastChanged) >= twentyFourHoursAgo &&
        new Date(d.lastChanged) < oneHourAgo,
    )
    .sort(
      (a, b) =>
        Math.abs(
          new Date(a.lastChanged).getTime() - twentyFourHoursAgo.getTime(),
        ) -
        Math.abs(
          new Date(b.lastChanged).getTime() - twentyFourHoursAgo.getTime(),
        ),
    );

  if (recentData.length === 0 || oldData.length === 0) return undefined;

  const recentDataPoint = recentData[0];
  const oldDataPoint = oldData[0];

  if (!recentDataPoint || !oldDataPoint) return undefined;

  const recentValue =
    typeof recentDataPoint.state === 'number'
      ? recentDataPoint.state
      : Number(recentDataPoint.state);
  const oldValue =
    typeof oldDataPoint.state === 'number'
      ? oldDataPoint.state
      : Number(oldDataPoint.state);

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

export function ValueCardWidget({ deviceId, sensor, config }: WidgetProps) {
  const { data: stateHistory = [] } = api.device.getStateHistory.useQuery({
    deviceId,
    stateKey: sensor.key,
    timeRange: '24h',
  });

  // Extract unit from attributes if not provided in sensor metadata
  const unit =
    sensor.unit ||
    ((stateHistory[0]?.attributes as Record<string, unknown> | undefined)
      ?.unit as string | undefined);

  const formattedValue = formatSensorValue(sensor.currentValue, unit);
  const trend = calculateTrend(
    typeof sensor.currentValue === 'number'
      ? sensor.currentValue
      : Number(sensor.currentValue) || 0,
    stateHistory,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{sensor.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-4xl font-bold tracking-tight">
          {formattedValue}
        </div>

        {sensor.lastChanged && (
          <div className="text-sm text-muted-foreground">
            Last updated:{' '}
            {format(new Date(sensor.lastChanged), 'MMM dd, HH:mm')}
          </div>
        )}

        {config.showTrend && trend && <TrendIndicator trend={trend} />}
      </CardContent>
    </Card>
  );
}

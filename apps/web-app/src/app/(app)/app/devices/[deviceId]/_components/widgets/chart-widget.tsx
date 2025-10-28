'use client';

import type { WidgetProps } from '@cove/types/widget';
import { Card, CardContent, CardHeader } from '@cove/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip } from '@cove/ui/chart';
import {
  fillTimeSeriesGaps,
  formatSensorValueForChart,
  formatSensorValueForTooltip,
  getDefaultFillInterval,
  getTimeRangeMs,
} from '@cove/utils';
import { format } from 'date-fns';
import { useQueryState } from 'nuqs';
import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useEntityData } from '../hooks/use-entity-data';

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

interface ChartDataPoint {
  label: string;
  timestamp: number;
  value: number;
  synthetic?: boolean;
  [key: string]: unknown;
}

export function ChartWidget({ sensor }: WidgetProps) {
  const [timeRange] = useQueryState('timeRange', {
    defaultValue: '24h',
    parse: (value) => (value as '1h' | '24h' | '7d' | '30d' | '90d') || '24h',
  });

  // Use the unified data hook with polling only
  const { aggregatedData, isLoading } = useEntityData({
    entityId: sensor.entityId,
    onStateChange: (newState) => {
      console.log('New state received:', newState);
    },
    timeRange: timeRange as '1h' | '24h' | '7d' | '30d' | '90d',
  });

  // Transform aggregated data to chart data with gap filling
  const chartData = React.useMemo((): ChartDataPoint[] => {
    // Convert aggregated data to base chart data
    const baseData = aggregatedData.map((point: unknown): ChartDataPoint => {
      const p = point as {
        timestamp: number;
        mean: number | null;
        min: number | null;
        max: number | null;
      };
      const value = p.mean ?? 0; // Use mean value, fallback to 0 if null
      return {
        label: format(new Date(p.timestamp), 'MMM dd HH:mm'),
        timestamp: p.timestamp,
        value: Number.isNaN(value) ? 0 : value,
      };
    });

    // Fill gaps to show values remained constant over time
    const timeRangeMs = getTimeRangeMs(
      (timeRange as '1h' | '24h' | '7d' | '30d' | '90d') || '24h',
    );
    const fillIntervalMs = getDefaultFillInterval(timeRangeMs);

    // Calculate the start of the time range to fill gaps from the beginning
    const fillFromTimestamp = Date.now() - timeRangeMs;

    const filled = fillTimeSeriesGaps(baseData, {
      defaultValue: 0, // Use 0 for missing historical data
      fillFromTimestamp,
      fillIntervalMs,
      fillToTimestamp: Date.now(),
      maxGapMs: fillIntervalMs * 3, // Fill gaps larger than 3x the interval
    });

    // Add labels to synthetic points
    const finalChartData = filled.map((point: ChartDataPoint) => ({
      ...point,
      label: format(new Date(point.timestamp), 'MMM dd HH:mm'),
    }));

    return finalChartData;
  }, [aggregatedData, timeRange]);

  // Calculate statistics for the current time range
  const stats = React.useMemo(() => {
    return calculateStats(
      aggregatedData as Array<{
        timestamp: number;
        mean: number | null;
        min: number | null;
        max: number | null;
      }>,
    );
  }, [aggregatedData]);

  // Extract unit from attributes if not provided in sensor metadata
  const unit = sensor.unit;

  const getTimeRangeDescription = () => {
    switch (timeRange) {
      case '1h':
        return 'Last hour';
      case '24h':
        return 'Last 24 hours';
      case '7d':
        return 'Last 7 days';
      case '30d':
        return 'Last 30 days';
      case '90d':
        return 'Last 90 days';
      default:
        return 'Last 24 hours';
    }
  };

  const chartConfig = {
    [sensor.key]: {
      color: 'var(--chart-1)',
      label: sensor.name,
    },
  } satisfies ChartConfig;

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader className="pb-2">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {sensor.name}
          </div>
          <div className="text-xs text-muted-foreground/70 mt-2">
            Loading sensor data...
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="aspect-auto h-[250px] w-full animate-pulse bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="@container/card">
        <CardHeader className="pb-2">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {sensor.name}
          </div>
          <div className="text-xs text-muted-foreground/70 mt-2">
            {getTimeRangeDescription()}
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="flex h-[250px] w-full items-center justify-center text-muted-foreground">
            No data available for this time range
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate min and max for Y-axis domain
  const values = chartData.map((d: ChartDataPoint) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = (maxValue - minValue) * 0.1 || 1; // 10% padding or 1 if range is 0
  const yMin = Math.max(0, minValue - padding);
  const yMax = maxValue + padding;

  return (
    <Card className="@container/card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {sensor.name}
          </div>
        </div>
        {/* Current Value and Statistics */}
        <div className="flex items-center justify-between mt-3">
          <div className="text-2xl font-light tracking-tight">
            {formatSensorValueForChart(
              typeof sensor.currentValue === 'number'
                ? sensor.currentValue
                : Number(sensor.currentValue) || 0,
            )}{' '}
            {unit && (
              <span className="text-sm text-muted-foreground/70 ml-1">
                {unit}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground/70 space-x-6">
            <span>Min {formatSensorValueForChart(stats.min)}</span>
            <span>Max {formatSensorValueForChart(stats.max)}</span>
            <span>Avg {formatSensorValueForChart(stats.avg)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          className="aspect-auto h-[250px] w-full"
          config={chartConfig}
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient
                id={`fill-${sensor.key}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              tickFormatter={(value: string) => {
                // Format based on time range
                if (timeRange === '1h') {
                  return format(
                    new Date(
                      chartData.find((d: ChartDataPoint) => d.label === value)
                        ?.timestamp || 0,
                    ),
                    'HH:mm',
                  );
                }
                if (timeRange === '24h') {
                  return format(
                    new Date(
                      chartData.find((d: ChartDataPoint) => d.label === value)
                        ?.timestamp || 0,
                    ),
                    'HH:mm',
                  );
                }
                if (timeRange === '7d') {
                  return format(
                    new Date(
                      chartData.find((d: ChartDataPoint) => d.label === value)
                        ?.timestamp || 0,
                    ),
                    'MMM dd',
                  );
                }
                if (timeRange === '30d' || timeRange === '90d') {
                  return format(
                    new Date(
                      chartData.find((d: ChartDataPoint) => d.label === value)
                        ?.timestamp || 0,
                    ),
                    'MMM dd',
                  );
                }
                return format(
                  new Date(
                    chartData.find((d: ChartDataPoint) => d.label === value)
                      ?.timestamp || 0,
                  ),
                  'MMM dd',
                );
              }}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              domain={[yMin, yMax]}
              tickFormatter={(value: number) => {
                // Use the new formatting utility
                return formatSensorValueForChart(value);
              }}
              tickLine={false}
              tickMargin={8}
              width={50}
            />
            <ChartTooltip
              content={({
                active,
                payload,
              }: {
                active?: boolean;
                payload?: Array<{ value: number; payload: ChartDataPoint }>;
              }) => {
                if (!active || !payload?.[0]) return null;

                const data = payload[0].payload as {
                  label: string;
                  timestamp: number;
                  value: number;
                };

                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid gap-2">
                      <div className="flex flex-col">
                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                          {sensor.name}
                        </span>
                        <span className="font-bold">
                          {formatSensorValueForTooltip(data.value, unit)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                          Time
                        </span>
                        <span className="font-bold text-muted-foreground">
                          {format(new Date(data.timestamp), 'MMM dd, HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Area
              dataKey="value"
              fill={`url(#fill-${sensor.key})`}
              fillOpacity={1}
              stroke="var(--chart-1)"
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

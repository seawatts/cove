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
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts';
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
  // Memoize the callback to prevent infinite loops
  const onStateChangeCallback = React.useCallback((newState: unknown) => {
    console.log('New state received:', newState);
  }, []);

  const { aggregatedData, isLoading, latestTelemetryValue, latestState } =
    useEntityData({
      entityId: sensor.entityId,
      onStateChange: onStateChangeCallback,
      timeRange: timeRange as '1h' | '24h' | '7d' | '30d' | '90d',
    });

  // Use latest telemetry value if available (most accurate), then latest state, then fall back to initial sensor value
  const currentValue =
    latestTelemetryValue !== undefined && latestTelemetryValue !== null
      ? latestTelemetryValue
      : latestState?.state !== undefined && latestState?.state !== null
        ? latestState.state
        : sensor.currentValue;

  // Transform aggregated data to chart data with gap filling
  const chartData = React.useMemo((): ChartDataPoint[] => {
    // Early return if no data
    if (!aggregatedData || aggregatedData.length === 0) {
      return [];
    }

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

    // Fill gaps to show missing data periods
    const timeRangeMs = getTimeRangeMs(
      (timeRange as '1h' | '24h' | '7d' | '30d' | '90d') || '24h',
    );
    const fillIntervalMs = getDefaultFillInterval(timeRangeMs);

    // Calculate timestamps - Date.now() is fine here since useMemo only runs when dependencies change
    const nowTimestamp = Date.now();
    const fillFromTimestamp = nowTimestamp - timeRangeMs;
    const fillToTimestamp = nowTimestamp;

    const filled = fillTimeSeriesGaps(baseData, {
      defaultValue: 0, // Use 0 for missing historical data
      fillFromTimestamp,
      fillIntervalMs,
      fillToTimestamp,
      maxGapMs: fillIntervalMs * 3, // Fill gaps larger than 3x the interval
    });

    // Find first and last real data points to distinguish gaps from leading/trailing empty regions
    // Important: point.synthetic might be undefined, so we need to explicitly check for false
    const realDataPoints = filled.filter((point) => point.synthetic !== true);
    const firstRealTimestamp = realDataPoints[0]?.timestamp;
    const lastRealTimestamp = realDataPoints.at(-1)?.timestamp;

    // Add labels to synthetic points and separate data keys for real vs missing data
    const finalChartData = filled.map((point: ChartDataPoint) => {
      // Explicitly check if synthetic is true (since undefined should be treated as false)
      const isSynthetic = point.synthetic === true;

      // Check if point is within the real data range (between first and last real data)
      const isBetweenRealData =
        firstRealTimestamp !== undefined &&
        lastRealTimestamp !== undefined &&
        point.timestamp >= firstRealTimestamp &&
        point.timestamp <= lastRealTimestamp;

      // For real data points: realValue has the value, missingValue is null (not rendered)
      if (!isSynthetic) {
        return {
          ...point,
          label: format(new Date(point.timestamp), 'MMM dd HH:mm'),
          missingValue: null,
          realValue: point.value,
        };
      }

      // For synthetic points BETWEEN real data:
      // - Keep realValue to maintain line continuity (forward-filled from previous real point)
      // - Also set missingValue to show dashed line overlay
      if (isBetweenRealData) {
        return {
          ...point,
          label: format(new Date(point.timestamp), 'MMM dd HH:mm'),
          missingValue: point.value, // Also show as dashed line
          realValue: point.value, // Keep the forward-filled value for line continuity
        };
      }

      // For leading/trailing synthetic points: exclude from chart (null for both)
      return {
        ...point,
        label: format(new Date(point.timestamp), 'MMM dd HH:mm'),
        missingValue: null,
        realValue: null,
      };
    });

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
    missingValue: {
      color: 'var(--muted-foreground)',
      label: 'No data',
    },
    realValue: {
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
              typeof currentValue === 'number'
                ? currentValue
                : Number(currentValue) || 0,
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
          <ComposedChart data={chartData}>
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
              {/* Separate gradient for missing data if needed */}
              <linearGradient
                id={`fill-missing-${sensor.key}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--muted-foreground)"
                  stopOpacity={0.2}
                />
                <stop
                  offset="95%"
                  stopColor="var(--muted-foreground)"
                  stopOpacity={0.05}
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
                  synthetic?: boolean;
                };

                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid gap-2">
                      <div className="flex flex-col">
                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                          {sensor.name}
                        </span>
                        <span className="font-bold">
                          {data.synthetic ? (
                            <span className="text-muted-foreground">
                              No data
                            </span>
                          ) : (
                            formatSensorValueForTooltip(data.value, unit)
                          )}
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
            {/* Render real data as filled blue area */}
            <Area
              connectNulls={false}
              dataKey="realValue"
              fill="var(--chart-1)"
              fillOpacity={0.4}
              name={sensor.name}
              stroke="var(--chart-1)"
              strokeWidth={2}
              type="monotone"
            />
            {/* Render missing data as dashed grey line overlay on top of blue area */}
            <Line
              connectNulls={false}
              dataKey="missingValue"
              dot={false}
              isAnimationActive={false}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 5"
              strokeWidth={2}
              type="monotone"
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

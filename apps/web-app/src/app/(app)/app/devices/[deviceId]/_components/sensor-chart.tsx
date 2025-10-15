'use client';

import { api } from '@cove/api/react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cove/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip } from '@cove/ui/chart';
import { useIsMobile } from '@cove/ui/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cove/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@cove/ui/toggle-group';
import {
  fillTimeSeriesGaps,
  getDefaultFillInterval,
  getTimeRangeMs,
} from '@cove/utils';
import { format } from 'date-fns';
import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

interface ChartDataPoint {
  label: string;
  timestamp: number;
  value: number;
  synthetic?: boolean;
}

interface SensorChartProps {
  deviceId: string;
  sensorKey: string; // 'co2', 'temperature', etc.
  sensorName: string; // 'CO2', 'Temperature', etc.
  unit?: string; // 'ppm', '°C', etc.
}

export function SensorChart({
  deviceId,
  sensorKey,
  sensorName,
  unit = '',
}: SensorChartProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState<'24h' | '7d' | '30d'>('24h');

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange('24h');
    }
  }, [isMobile]);

  const { data: stateHistory = [], isLoading } =
    api.device.getStateHistory.useQuery(
      {
        deviceId,
        stateKey: sensorKey,
        timeRange,
      },
      {
        refetchInterval: 30000, // Refresh every 30 seconds
      },
    );

  // Transform state history to chart data with gap filling
  const chartData = React.useMemo((): ChartDataPoint[] => {
    // Convert state history to base chart data
    const baseData = stateHistory.map((state): ChartDataPoint => {
      const value =
        typeof state.state === 'number' ? state.state : Number(state.state);
      return {
        label: format(new Date(state.lastChanged), 'MMM dd HH:mm'),
        timestamp: new Date(state.lastChanged).getTime(),
        value: Number.isNaN(value) ? 0 : value,
      };
    });

    // Fill gaps to show values remained constant over time
    const timeRangeMs = getTimeRangeMs(timeRange);
    const fillIntervalMs = getDefaultFillInterval(timeRangeMs);

    const filled = fillTimeSeriesGaps(baseData, {
      fillIntervalMs,
      fillToTimestamp: Date.now(),
      maxGapMs: fillIntervalMs * 3, // Fill gaps larger than 3x the interval
    });

    // Add labels to synthetic points
    return filled.map((point) => ({
      ...point,
      label: format(new Date(point.timestamp), 'MMM dd HH:mm'),
    }));
  }, [stateHistory, timeRange]);

  const chartConfig = {
    [sensorKey]: {
      color: 'var(--chart-1)',
      label: sensorName,
    },
  } satisfies ChartConfig;

  const getTimeRangeDescription = () => {
    switch (timeRange) {
      case '24h':
        return 'Last 24 hours';
      case '7d':
        return 'Last 7 days';
      case '30d':
        return 'Last 30 days';
    }
  };

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>
            {sensorName} {unit && `(${unit})`}
          </CardTitle>
          <CardDescription>Loading sensor data...</CardDescription>
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
        <CardHeader>
          <CardTitle>
            {sensorName} {unit && `(${unit})`}
          </CardTitle>
          <CardDescription>{getTimeRangeDescription()}</CardDescription>
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
      <CardHeader>
        <CardTitle>
          {sensorName} {unit && `(${unit})`}
        </CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {getTimeRangeDescription()}
          </span>
          <span className="@[540px]/card:hidden">
            {getTimeRangeDescription()}
          </span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
            onValueChange={(value) => {
              if (value) setTimeRange(value as '24h' | '7d' | '30d');
            }}
            type="single"
            value={timeRange}
            variant="outline"
          >
            <ToggleGroupItem value="24h">24 hours</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
          </ToggleGroup>
          <Select
            onValueChange={(value) =>
              setTimeRange(value as '24h' | '7d' | '30d')
            }
            value={timeRange}
          >
            <SelectTrigger
              aria-label="Select time range"
              className="w-[160px] rounded-lg @[767px]/card:hidden sm:ml-auto"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem className="rounded-lg" value="24h">
                Last 24 hours
              </SelectItem>
              <SelectItem className="rounded-lg" value="7d">
                Last 7 days
              </SelectItem>
              <SelectItem className="rounded-lg" value="30d">
                Last 30 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          className="aspect-auto h-[250px] w-full"
          config={chartConfig}
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient
                id={`fill-${sensorKey}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={`var(--color-${sensorKey})`}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={`var(--color-${sensorKey})`}
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
                // Format numbers nicely
                if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                if (value % 1 !== 0) return value.toFixed(1);
                return value.toString();
              }}
              tickLine={false}
              tickMargin={8}
              width={50}
            />
            <ChartTooltip
              content={({ active, payload }) => {
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
                          {sensorName}
                        </span>
                        <span className="font-bold">
                          {data.value.toFixed(1)} {unit}
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
              fill={`url(#fill-${sensorKey})`}
              fillOpacity={1}
              stroke={`var(--color-${sensorKey})`}
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

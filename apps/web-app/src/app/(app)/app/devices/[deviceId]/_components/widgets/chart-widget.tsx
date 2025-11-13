'use client';

import { hubApi } from '@cove/api/hub/react';
import { getAlertSeverityColorValue } from '@cove/types';
import type { AlertSeverity } from '@cove/types/alert';
import type { WidgetProps } from '@cove/types/widget';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader } from '@cove/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip } from '@cove/ui/chart';
import { Icons } from '@cove/ui/custom/icons';
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
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { useUserPreferences } from '../../../_components/user-preferences-provider';
import {
  timeRangeParser,
  zoomEndParser,
  zoomStartParser,
} from '../../_lib/query-parsers';
import { useEntityData } from '../hooks/use-entity-data';
import { useChartVisibility } from '../lazy-chart-wrapper';

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

// Custom shape for ultra-thin vertical alert indicator bars
const ThinVerticalBar = ({
  x,
  y,
  height,
  fill,
  fillOpacity,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  fillOpacity: number;
}) => {
  // Override width to be exactly 3 pixels for a very thin bar
  const thinWidth = 3;
  return (
    <rect
      fill={fill}
      fillOpacity={fillOpacity}
      height={height}
      width={thinWidth}
      x={x}
      y={y}
    />
  );
};

const ChartWidgetComponent = ({ sensor, syncId }: WidgetProps) => {
  const [timeRange] = useQueryState('timeRange', timeRangeParser);

  // Get user preferences for tooltip sync
  const { preferences } = useUserPreferences();
  const shouldSyncTooltips = preferences.syncTooltips ?? true;

  // Zoom state - stored in URL for persistence across page refreshes
  const [zoomStart, setZoomStart] = useQueryState('zoomStart', zoomStartParser);
  const [zoomEnd, setZoomEnd] = useQueryState('zoomEnd', zoomEndParser);

  // Check if chart is visible to defer API calls
  const isVisible = useChartVisibility();

  // Temporary drag selection state (not persisted)
  const [refAreaLeft, setRefAreaLeft] = React.useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = React.useState<string | null>(null);

  // Use the unified data hook with polling only
  // Memoize the callback to prevent infinite loops
  const onStateChangeCallback = React.useCallback((newState: unknown) => {
    console.log('New state received:', newState);
  }, []);

  const { aggregatedData, isLoading, latestTelemetryValue, latestState } =
    useEntityData({
      enabled: isVisible, // Only fetch when visible
      entityId: sensor.entityId,
      onStateChange: onStateChangeCallback,
      timeRange,
      zoomEnd, // Pass zoom end from URL
      zoomStart, // Pass zoom start from URL
    });

  // Fetch alert configurations for this entity
  // Query by entityId only, not by field, since sensor.key is the entity key
  // not the telemetry field name (like 'esp_temperature')
  const { data: alertConfigs = [] } = hubApi.alerts.list.useQuery(
    {
      entityId: sensor.entityId,
    },
    {
      enabled: isVisible, // Only fetch when visible
      refetchInterval: isVisible ? 60000 : false, // 1 minute when visible, disabled otherwise
      staleTime: 0, // Always use fresh data from polling
    },
  );

  // Filter alerts to only show those marked as visible on graph
  const visibleAlertConfigs = React.useMemo(
    () => alertConfigs.filter((config) => config.showInGraph),
    [alertConfigs],
  );

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
    const timeRangeMs = getTimeRangeMs(timeRange);
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

  // Calculate X-axis domain based on zoom (using label values, not indices)
  const xAxisDomain = React.useMemo(():
    | [string, string]
    | ['auto', 'auto']
    | ['dataMin', 'dataMax'] => {
    if (zoomStart && zoomEnd) {
      // Find the actual data labels for the zoom domain
      const leftPoint = chartData.find(
        (d: ChartDataPoint) => d.timestamp >= zoomStart,
      );
      const rightPoint = chartData.find(
        (d: ChartDataPoint) => d.timestamp >= zoomEnd,
      );
      if (leftPoint && rightPoint) {
        return [leftPoint.label, rightPoint.label];
      }
    }
    return ['dataMin', 'dataMax'];
  }, [chartData, zoomStart, zoomEnd]);

  // Filter data for Y-axis domain calculation (only the visible range)
  const displayData = React.useMemo(() => {
    if (zoomStart && zoomEnd) {
      return chartData.filter(
        (d: ChartDataPoint) =>
          d.timestamp >= zoomStart && d.timestamp <= zoomEnd,
      );
    }
    return chartData;
  }, [chartData, zoomStart, zoomEnd]);

  // Track if we're currently updating zoom to prevent cascading updates
  // Use a timestamp-based debounce to prevent rapid successive updates
  const isZoomingRef = React.useRef(false);
  const lastZoomUpdateRef = React.useRef(0);
  const chartDataRef = React.useRef(chartData);
  const zoomStartRef = React.useRef(zoomStart);
  const zoomEndRef = React.useRef(zoomEnd);

  // Keep refs up to date
  React.useEffect(() => {
    chartDataRef.current = chartData;
  }, [chartData]);

  React.useEffect(() => {
    zoomStartRef.current = zoomStart;
    zoomEndRef.current = zoomEnd;
  }, [zoomStart, zoomEnd]);

  // Zoom handlers - update URL params so all charts zoom together
  // Use refs to completely break dependency cycles
  const zoom = React.useCallback(() => {
    const now = Date.now();

    // Prevent re-entrant calls and debounce rapid updates
    if (isZoomingRef.current || now - lastZoomUpdateRef.current < 200) {
      return;
    }

    if (refAreaLeft === refAreaRight || !refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    // Ensure left is before right
    const [left, right] =
      refAreaLeft && refAreaRight && refAreaLeft > refAreaRight
        ? [refAreaRight, refAreaLeft]
        : [refAreaLeft, refAreaRight];

    // Use refs to access current values without adding them as dependencies
    const leftPoint = chartDataRef.current.find(
      (d: ChartDataPoint) => d.label === left,
    );
    const rightPoint = chartDataRef.current.find(
      (d: ChartDataPoint) => d.label === right,
    );

    // Only update if we have valid points and values are actually different
    if (
      leftPoint &&
      rightPoint &&
      (leftPoint.timestamp !== zoomStartRef.current ||
        rightPoint.timestamp !== zoomEndRef.current)
    ) {
      isZoomingRef.current = true;
      lastZoomUpdateRef.current = now;

      // Update URL params - this will apply to all charts on the page
      void setZoomStart(leftPoint.timestamp);
      void setZoomEnd(rightPoint.timestamp);

      // Reset flag after a delay to allow state to settle
      setTimeout(() => {
        isZoomingRef.current = false;
      }, 250);
    }

    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, setZoomStart, setZoomEnd]);

  const resetZoom = React.useCallback(() => {
    const now = Date.now();

    // Prevent re-entrant calls and debounce
    if (isZoomingRef.current || now - lastZoomUpdateRef.current < 200) {
      return;
    }

    isZoomingRef.current = true;
    lastZoomUpdateRef.current = now;

    void setZoomStart(null);
    void setZoomEnd(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);

    setTimeout(() => {
      isZoomingRef.current = false;
    }, 250);
  }, [setZoomStart, setZoomEnd]);

  // Calculate brush indices based on URL zoom state (purely visual - no onChange)
  const brushIndices = React.useMemo(() => {
    if (!zoomStart || !zoomEnd || chartData.length === 0) {
      return { endIndex: chartData.length - 1, startIndex: 0 };
    }

    const startIndex = chartData.findIndex(
      (d: ChartDataPoint) => d.timestamp >= zoomStart,
    );
    const endIndex = chartData.findIndex(
      (d: ChartDataPoint) => d.timestamp >= zoomEnd,
    );

    return {
      endIndex: endIndex === -1 ? chartData.length - 1 : endIndex,
      startIndex: startIndex === -1 ? 0 : startIndex,
    };
  }, [chartData, zoomStart, zoomEnd]);

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
      <Card
        style={{
          contain: 'layout style paint',
          contentVisibility: 'auto',
        }}
      >
        <CardHeader className="pb-2">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {sensor.name}
          </div>
          <div className="text-xs text-muted-foreground/70 mt-2">
            Loading sensor data...
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="aspect-auto h-[340px] w-full animate-pulse bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card
        style={{
          contain: 'layout style paint',
          contentVisibility: 'auto',
        }}
      >
        <CardHeader className="pb-2">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {sensor.name}
          </div>
          <div className="text-xs text-muted-foreground/70 mt-2">
            {getTimeRangeDescription()}
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="flex h-[340px] w-full items-center justify-center text-muted-foreground">
            No data available for this time range
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate min and max for Y-axis domain, including alert thresholds
  const values = displayData.map((d: ChartDataPoint) => d.value);
  const dataMinValue = Math.min(...values);
  const dataMaxValue = Math.max(...values);

  // Include alert thresholds in domain calculation
  const alertThresholdValues: number[] = [];
  for (const config of alertConfigs) {
    if (config.alertType === 'threshold' && config.thresholdValue !== null) {
      alertThresholdValues.push(config.thresholdValue);
    }
    if (config.alertType === 'range') {
      if (config.rangeMin !== null) alertThresholdValues.push(config.rangeMin);
      if (config.rangeMax !== null) alertThresholdValues.push(config.rangeMax);
    }
  }

  const minValue =
    alertThresholdValues.length > 0
      ? Math.min(dataMinValue, ...alertThresholdValues)
      : dataMinValue;
  const maxValue =
    alertThresholdValues.length > 0
      ? Math.max(dataMaxValue, ...alertThresholdValues)
      : dataMaxValue;

  const padding = (maxValue - minValue) * 0.1 || 1; // 10% padding or 1 if range is 0
  const yMin = Math.max(0, minValue - padding);
  const yMax = maxValue + padding;

  return (
    <Card
      style={{
        contain: 'layout style paint',
        // Let browser skip rendering off-screen charts
        contentVisibility: 'auto',
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {sensor.name}
            </div>
            {!zoomStart && !zoomEnd && (
              <div className="text-xs text-muted-foreground/50">
                Click and drag to zoom
              </div>
            )}
          </div>
          {(zoomStart || zoomEnd) && (
            <Button onClick={resetZoom} size="sm" variant="outline">
              <Icons.Maximize size="sm" />
              <span className="ml-1">Reset Zoom</span>
            </Button>
          )}
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
          className="aspect-auto h-[340px] w-full"
          config={chartConfig}
          style={{
            // GPU acceleration for smoother animations
            transform: 'translateZ(0)',
            // Hint to browser about what will change
            willChange: 'auto',
          }}
        >
          <ComposedChart
            data={chartData}
            onMouseDown={(e: { activeLabel?: string }) => {
              if (!isZoomingRef.current && e?.activeLabel) {
                setRefAreaLeft(e.activeLabel);
              }
            }}
            onMouseMove={(e: { activeLabel?: string }) => {
              if (!isZoomingRef.current && refAreaLeft && e?.activeLabel) {
                setRefAreaRight(e.activeLabel);
              }
            }}
            onMouseUp={zoom}
            style={{ cursor: refAreaLeft ? 'col-resize' : 'crosshair' }}
            syncId={shouldSyncTooltips ? syncId : undefined}
          >
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
              domain={xAxisDomain}
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
              isAnimationActive={false}
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

            {/* Alert threshold lines and shaded regions */}
            {visibleAlertConfigs.map((config, index) => {
              if (config.alertType === 'threshold' && config.thresholdValue) {
                const color = getAlertSeverityColorValue(
                  config.severity as AlertSeverity,
                );
                return (
                  <ReferenceLine
                    key={config.id}
                    label={{
                      fill: color,
                      fontSize: 11,
                      fontWeight: 500,
                      position: 'right',
                      value: config.name,
                    }}
                    stroke={color}
                    strokeDasharray="5 5"
                    strokeOpacity={0.7}
                    strokeWidth={1.5}
                    y={config.thresholdValue}
                  />
                );
              }

              if (
                config.alertType === 'range' &&
                config.rangeMin !== null &&
                config.rangeMax !== null
              ) {
                const color = getAlertSeverityColorValue(
                  config.severity as AlertSeverity,
                );

                // Calculate left-side indicator position using array indices
                // Use displayData (visible data) not chartData to avoid NaN when zoomed
                const visibleData =
                  displayData.length > 0 ? displayData : chartData;
                const firstLabel = visibleData[0]?.label;
                const secondLabel =
                  visibleData[1]?.label || visibleData[0]?.label;

                // Only show label on the first range config to avoid clutter
                const showLabel = index === 0;

                // Skip rendering if we don't have valid labels
                if (!firstLabel || !secondLabel) {
                  return null;
                }

                return (
                  <React.Fragment key={config.id}>
                    {/* Left-side vertical bar above max (problem zone) - with custom thin shape */}
                    {config.rangeMax < yMax && (
                      <ReferenceArea
                        fill={color}
                        fillOpacity={0.15}
                        ifOverflow="extendDomain"
                        shape={(props: unknown) => (
                          <ThinVerticalBar
                            fill={color}
                            fillOpacity={0.6}
                            {...(props as {
                              x: number;
                              y: number;
                              width: number;
                              height: number;
                            })}
                          />
                        )}
                        strokeOpacity={0}
                        x1={firstLabel}
                        x2={secondLabel}
                        y1={config.rangeMax}
                        y2={yMax}
                      />
                    )}
                    {/* Left-side vertical bar below min (problem zone) - with custom thin shape */}
                    {config.rangeMin > yMin && (
                      <ReferenceArea
                        fill={color}
                        fillOpacity={0.15}
                        ifOverflow="extendDomain"
                        shape={(props: unknown) => (
                          <ThinVerticalBar
                            fill={color}
                            fillOpacity={0.6}
                            {...(props as {
                              x: number;
                              y: number;
                              width: number;
                              height: number;
                            })}
                          />
                        )}
                        strokeOpacity={0}
                        x1={firstLabel}
                        x2={secondLabel}
                        y1={yMin}
                        y2={config.rangeMin}
                      />
                    )}
                    {/* Threshold lines - subtle horizontal lines */}
                    <ReferenceLine
                      stroke={color}
                      strokeDasharray="5 5"
                      strokeOpacity={0.3}
                      strokeWidth={1}
                      y={config.rangeMax}
                    />
                    <ReferenceLine
                      label={
                        showLabel
                          ? {
                              fill: color,
                              fontSize: 11,
                              fontWeight: 500,
                              position: 'right',
                              value: config.name,
                            }
                          : undefined
                      }
                      stroke={color}
                      strokeDasharray="5 5"
                      strokeOpacity={0.3}
                      strokeWidth={1}
                      y={config.rangeMin}
                    />
                  </React.Fragment>
                );
              }

              return null;
            })}

            {/* Zoom selection area - show while dragging */}
            {refAreaLeft && refAreaRight && (
              <ReferenceArea
                fill="hsl(var(--primary) / 0.2)"
                fillOpacity={1}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 3"
                strokeOpacity={0.8}
                strokeWidth={2}
                x1={refAreaLeft}
                x2={refAreaRight}
                yAxisId="0"
              />
            )}

            {/* Brush sparkline - shows overview and current zoom position */}
            <Brush
              dataKey="label"
              endIndex={brushIndices.endIndex}
              height={48}
              onChange={(brushData: {
                startIndex?: number;
                endIndex?: number;
              }) => {
                const now = Date.now();

                // Prevent updates during active zoom operations
                if (
                  isZoomingRef.current ||
                  now - lastZoomUpdateRef.current < 200
                ) {
                  return;
                }

                if (
                  brushData.startIndex === undefined ||
                  brushData.endIndex === undefined ||
                  chartData.length === 0
                ) {
                  return;
                }

                const startPoint = chartData[brushData.startIndex];
                const endPoint = chartData[brushData.endIndex];

                if (!startPoint || !endPoint) {
                  return;
                }

                // Check if this represents the full range (reset zoom)
                const isFullRange =
                  brushData.startIndex === 0 &&
                  brushData.endIndex === chartData.length - 1;

                if (isFullRange) {
                  // Only reset if currently zoomed
                  if (zoomStartRef.current || zoomEndRef.current) {
                    isZoomingRef.current = true;
                    lastZoomUpdateRef.current = now;
                    void setZoomStart(null);
                    void setZoomEnd(null);
                    setTimeout(() => {
                      isZoomingRef.current = false;
                    }, 250);
                  }
                } else {
                  // Only update if actually different
                  if (
                    startPoint.timestamp !== zoomStartRef.current ||
                    endPoint.timestamp !== zoomEndRef.current
                  ) {
                    isZoomingRef.current = true;
                    lastZoomUpdateRef.current = now;
                    void setZoomStart(startPoint.timestamp);
                    void setZoomEnd(endPoint.timestamp);
                    setTimeout(() => {
                      isZoomingRef.current = false;
                    }, 250);
                  }
                }
              }}
              startIndex={brushIndices.startIndex}
              stroke="hsl(var(--border))"
              tickFormatter={(value: string) => {
                const point = chartData.find(
                  (d: ChartDataPoint) => d.label === value,
                );
                if (!point) return '';
                if (timeRange === '1h' || timeRange === '24h') {
                  return format(new Date(point.timestamp), 'HH:mm');
                }
                return format(new Date(point.timestamp), 'MMM dd');
              }}
              travellerWidth={10}
            >
              <Line
                dataKey="realValue"
                dot={false}
                isAnimationActive={false}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                type="monotone"
              />
            </Brush>
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

// Memoize to prevent re-renders when parent components update due to sidebar toggles
export const ChartWidget = React.memo(
  ChartWidgetComponent,
  (prevProps, nextProps) => {
    // Only re-render if the sensor entityId or key changes
    return (
      prevProps.sensor.entityId === nextProps.sensor.entityId &&
      prevProps.sensor.key === nextProps.sensor.key
    );
  },
);

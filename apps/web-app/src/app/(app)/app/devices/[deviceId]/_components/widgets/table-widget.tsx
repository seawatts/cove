'use client';

import { api } from '@cove/api/react';
import type { WidgetProps } from '@cove/types/widget';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { formatSensorValue } from '@cove/utils/format-sensor-value';
import { format, formatDistanceToNow } from 'date-fns';
import * as React from 'react';

interface TableRow {
  timestamp: Date;
  value: unknown;
  formattedValue: string;
  relativeTime: string;
}

export function TableWidget({ sensor }: WidgetProps) {
  const { data: stateHistory = [], isLoading } =
    api.entity.getStateHistory.useQuery({
      entityId: sensor.key, // sensor.key is now the entityId
      timeRange: '24h',
    });

  // Extract unit from attributes if not provided in sensor metadata
  const unit =
    sensor.unit ||
    ((stateHistory[0]?.attributes as Record<string, unknown> | undefined)
      ?.unit as string | undefined);

  const tableData = React.useMemo((): TableRow[] => {
    return stateHistory
      .slice(-20) // Show last 20 entries
      .reverse() // Most recent first
      .map((state) => {
        const timestamp = new Date(state.lastChanged);
        const value = state.state;
        const formattedValue = formatSensorValue(value, unit);
        const relativeTime = formatDistanceToNow(timestamp, {
          addSuffix: true,
        });

        return {
          formattedValue,
          relativeTime,
          timestamp,
          value,
        };
      });
  }, [stateHistory, unit]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{sensor.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map(() => (
              <div
                className="flex justify-between items-center"
                key={crypto.randomUUID()}
              >
                <div className="h-4 bg-muted animate-pulse rounded w-24" />
                <div className="h-4 bg-muted animate-pulse rounded w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tableData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{sensor.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{sensor.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex justify-between items-center text-sm font-medium text-muted-foreground border-b pb-2">
            <span>Time</span>
            <span>Value</span>
          </div>

          {/* Data rows */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {tableData.map((row, index) => (
              <div
                className="flex justify-between items-center text-sm hover:bg-muted/50 rounded px-2 py-1 transition-colors"
                key={`${row.timestamp.getTime()}-${index}`}
              >
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">
                    {row.relativeTime}
                  </span>
                  <span className="text-xs">
                    {format(row.timestamp, 'HH:mm:ss')}
                  </span>
                </div>
                <span className="font-mono text-sm">{row.formattedValue}</span>
              </div>
            ))}
          </div>

          {/* Summary */}
          {tableData.length > 0 && (
            <div className="border-t pt-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Latest:</span>
                <span className="font-mono">
                  {formatSensorValue(sensor.currentValue, unit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total readings:</span>
                <span>{tableData.length}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

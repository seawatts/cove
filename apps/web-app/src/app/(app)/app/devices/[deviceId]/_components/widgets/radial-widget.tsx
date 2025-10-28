'use client';

import type { WidgetProps } from '@cove/types/widget';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { ChartContainer } from '@cove/ui/chart';
import { RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';

interface RadialData {
  value: number;
  fill: string;
  name: string;
}

function getColorForValue(value: number, sensorKey: string): string {
  // Different color schemes based on sensor type and value ranges
  if (sensorKey.includes('battery')) {
    if (value >= 75) return 'hsl(142, 76%, 36%)'; // Green
    if (value >= 50) return 'hsl(45, 93%, 47%)'; // Yellow
    if (value >= 25) return 'hsl(38, 92%, 50%)'; // Orange
    return 'hsl(0, 84%, 60%)'; // Red
  }

  if (sensorKey.includes('humidity')) {
    if (value >= 60 && value <= 70) return 'hsl(142, 76%, 36%)'; // Green (ideal range)
    if (value >= 40 && value <= 80) return 'hsl(45, 93%, 47%)'; // Yellow (acceptable)
    return 'hsl(0, 84%, 60%)'; // Red (too high/low)
  }

  // Default color scheme
  return 'hsl(var(--chart-1))';
}

export function RadialWidget({ sensor }: WidgetProps) {
  const value =
    typeof sensor.currentValue === 'number'
      ? sensor.currentValue
      : Number(sensor.currentValue) || 0;

  // Ensure value is between 0 and 100 for percentage-based sensors
  const normalizedValue = Math.max(0, Math.min(100, value));

  const color = getColorForValue(normalizedValue, sensor.key);

  const data: RadialData[] = [
    {
      fill: color,
      name: sensor.name,
      value: normalizedValue,
    },
  ];

  const chartConfig = {
    value: {
      color: color,
      label: sensor.name,
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{sensor.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <ChartContainer
            className="mx-auto aspect-square max-h-[200px]"
            config={chartConfig}
          >
            <ResponsiveContainer height="100%" width="100%">
              <RadialBarChart
                barSize={20}
                cx="50%"
                cy="50%"
                data={data}
                endAngle={0}
                innerRadius="60%"
                outerRadius="90%"
                startAngle={180}
              >
                <RadialBar
                  cornerRadius={10}
                  dataKey="value"
                  fill="var(--color-value)"
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* Center value display */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold">
                {normalizedValue.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {sensor.unit || '%'}
              </div>
            </div>
          </div>
        </div>

        {/* Last updated info removed - not available in sensor metadata */}

        {/* Status indicator */}
        <div className="flex justify-center">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import type { WidgetProps } from '@cove/types/widget';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { formatSensorValue } from '@cove/utils/format-sensor-value';

interface GaugeSegment {
  min: number;
  max: number;
  color: string;
  label: string;
}

function getGaugeConfig(
  sensorKey: string,
  _value: number,
): { segments: GaugeSegment[]; min: number; max: number } {
  // Temperature gauge (Celsius)
  if (sensorKey.includes('temperature')) {
    return {
      max: 50,
      min: -10,
      segments: [
        { color: 'hsl(217, 91%, 60%)', label: 'Cold', max: 0, min: -10 },
        { color: 'hsl(142, 76%, 36%)', label: 'Cool', max: 20, min: 0 },
        { color: 'hsl(45, 93%, 47%)', label: 'Comfortable', max: 30, min: 20 },
        { color: 'hsl(38, 92%, 50%)', label: 'Warm', max: 40, min: 30 },
        { color: 'hsl(0, 84%, 60%)', label: 'Hot', max: 50, min: 40 },
      ],
    };
  }

  // Pressure gauge (hPa)
  if (sensorKey.includes('pressure')) {
    return {
      max: 1050,
      min: 950,
      segments: [
        { color: 'hsl(0, 84%, 60%)', label: 'Low', max: 980, min: 950 },
        { color: 'hsl(45, 93%, 47%)', label: 'Normal', max: 1010, min: 980 },
        { color: 'hsl(142, 76%, 36%)', label: 'High', max: 1050, min: 1010 },
      ],
    };
  }

  // RSSI gauge (dBm)
  if (sensorKey.includes('rssi') || sensorKey.includes('signal')) {
    return {
      max: -30,
      min: -100,
      segments: [
        { color: 'hsl(0, 84%, 60%)', label: 'Weak', max: -80, min: -100 },
        { color: 'hsl(38, 92%, 50%)', label: 'Fair', max: -60, min: -80 },
        { color: 'hsl(45, 93%, 47%)', label: 'Good', max: -40, min: -60 },
        { color: 'hsl(142, 76%, 36%)', label: 'Excellent', max: -30, min: -40 },
      ],
    };
  }

  // Default gauge (0-100)
  return {
    max: 100,
    min: 0,
    segments: [
      { color: 'hsl(0, 84%, 60%)', label: 'Low', max: 25, min: 0 },
      { color: 'hsl(38, 92%, 50%)', label: 'Medium', max: 50, min: 25 },
      { color: 'hsl(45, 93%, 47%)', label: 'Good', max: 75, min: 50 },
      { color: 'hsl(142, 76%, 36%)', label: 'High', max: 100, min: 75 },
    ],
  };
}

function GaugeSVG({
  value,
  config,
  size = 200,
}: {
  value: number;
  config: { segments: GaugeSegment[]; min: number; max: number };
  size?: number;
}) {
  const { segments, min, max } = config;
  const radius = size * 0.4;
  const strokeWidth = size * 0.08;
  const centerX = size / 2;
  const centerY = size / 2;

  // Calculate angle (180 degrees arc, starting from left)
  const normalizedValue = Math.max(min, Math.min(max, value));
  const percentage = (normalizedValue - min) / (max - min);
  const angle = 180 * percentage; // 0 to 180 degrees
  const radians = (angle - 180) * (Math.PI / 180); // Convert to radians, offset by 180

  // Calculate needle position
  const needleLength = radius * 0.8;
  const needleX = centerX + needleLength * Math.cos(radians);
  const needleY = centerY + needleLength * Math.sin(radians);

  // Calculate arc paths for segments
  const segmentArcs = segments.map((segment) => {
    const startPercentage = (segment.min - min) / (max - min);
    const endPercentage = (segment.max - min) / (max - min);
    const startAngle = 180 * startPercentage - 180;
    const endAngle = 180 * endPercentage - 180;

    const startRadians = startAngle * (Math.PI / 180);
    const endRadians = endAngle * (Math.PI / 180);

    const startX = centerX + radius * Math.cos(startRadians);
    const startY = centerY + radius * Math.sin(startRadians);
    const endX = centerX + radius * Math.cos(endRadians);
    const endY = centerY + radius * Math.sin(endRadians);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return {
      color: segment.color,
      path: `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
    };
  });

  return (
    <svg className="overflow-visible" height={size} width={size}>
      <title>Gauge Chart</title>
      {/* Background circle */}
      <circle
        cx={centerX}
        cy={centerY}
        fill="none"
        opacity={0.3}
        r={radius}
        stroke="hsl(var(--border))"
        strokeWidth={strokeWidth}
      />

      {/* Segments */}
      {segmentArcs.map((arc) => (
        <path
          d={arc.path}
          fill="none"
          key={arc.color}
          stroke={arc.color}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      ))}

      {/* Needle */}
      <line
        stroke="hsl(var(--foreground))"
        strokeLinecap="round"
        strokeWidth={strokeWidth * 0.5}
        x1={centerX}
        x2={needleX}
        y1={centerY}
        y2={needleY}
      />

      {/* Center dot */}
      <circle
        cx={centerX}
        cy={centerY}
        fill="hsl(var(--foreground))"
        r={strokeWidth * 0.6}
      />
    </svg>
  );
}

export function GaugeWidget({ sensor }: WidgetProps) {
  const value =
    typeof sensor.currentValue === 'number'
      ? sensor.currentValue
      : Number(sensor.currentValue) || 0;
  const gaugeConfig = getGaugeConfig(sensor.key, value);

  // Find current segment for status
  const currentSegment = gaugeConfig.segments.find(
    (segment) => value >= segment.min && value <= segment.max,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{sensor.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          {/* Gauge SVG */}
          <div className="relative">
            <GaugeSVG config={gaugeConfig} value={value} />

            {/* Value display */}
            <div className="absolute inset-0 flex items-end justify-center pb-8">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatSensorValue(value, sensor.unit)}
                </div>
                {currentSegment && (
                  <div
                    className="text-sm font-medium"
                    style={{ color: currentSegment.color }}
                  >
                    {currentSegment.label}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Range indicators */}
          <div className="flex justify-between w-full text-xs text-muted-foreground px-4">
            <span>{gaugeConfig.min}</span>
            <span>{gaugeConfig.max}</span>
          </div>
        </div>

        {/* Last updated info removed - not available in sensor metadata */}
      </CardContent>
    </Card>
  );
}

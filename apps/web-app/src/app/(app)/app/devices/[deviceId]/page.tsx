import { getApi } from '@cove/api/server';
import type { SensorMetadata } from '@cove/types/widget';
import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { H2, Text } from '@cove/ui/custom/typography';
import { Power } from 'lucide-react';
import { Suspense } from 'react';
import { ESPHomeControls } from './_components/esphome-controls';
import { HueLightControls } from './_components/hue-light-controls';
import { SensorWidget } from './_components/sensor-widget';

interface DevicePageProps {
  params: Promise<{ deviceId: string }>;
}

export default async function DevicePage({ params }: DevicePageProps) {
  const { deviceId } = await params;

  return (
    <div className="grid gap-6 p-6">
      <Suspense fallback={<div>Loading device...</div>}>
        <DeviceDetails deviceId={deviceId} />
      </Suspense>
    </div>
  );
}

async function DeviceDetails({ deviceId }: { deviceId: string }) {
  // Fetch device from tRPC
  const device = await (await getApi()).device.get.fetch({ id: deviceId });

  if (!device) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-8 items-center justify-center text-center">
          <Text>Device not found</Text>
        </CardContent>
      </Card>
    );
  }

  const isHueLight = device.protocol === 'hue' && device.deviceType === 'light';
  const isESPHomeDevice = device.protocol === 'esphome';

  // Extract sensors from device state dynamically
  const sensors: SensorMetadata[] =
    device.state && typeof device.state === 'object'
      ? Object.entries(device.state)
          .filter(([_key, value]) => {
            // Filter out non-sensor properties
            return typeof value === 'number' || typeof value === 'boolean';
          })
          .map(([key, value]) => ({
            currentValue: value,
            key,
            lastChanged: new Date(),
            name: key
              .split('_')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' '),
            type: typeof value === 'boolean' ? 'binary' : 'continuous',
          }))
      : [];

  return (
    <>
      <div className="grid gap-2">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4">
          <H2>{device.name}</H2>
          <Badge variant={device.online ? 'default' : 'destructive'}>
            {device.online ? 'Online' : 'Offline'}
          </Badge>
        </div>
        <Text variant="muted">
          {device.deviceType} • {device.protocol || 'Unknown protocol'}
          {device.room && ` • ${device.room.name}`}
        </Text>
        {(device.host || device.ipAddress) && (
          <Text className="text-sm" variant="muted">
            Host: {device.host || device.ipAddress}
          </Text>
        )}
      </div>

      {isHueLight ? (
        <HueLightControls deviceId={deviceId} lightState={device.state} />
      ) : isESPHomeDevice ? (
        <ESPHomeControls deviceId={deviceId} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Current State</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {device.state && Object.keys(device.state).length > 0 ? (
                Object.entries(device.state).map(([key, value]) => (
                  <div className="grid grid-cols-[120px_1fr] gap-2" key={key}>
                    <Text className="capitalize" variant="muted">
                      {key.replace(/_/g, ' ')}:
                    </Text>
                    <Text>{String(value)}</Text>
                  </div>
                ))
              ) : (
                <Text className="text-center py-4" variant="muted">
                  No state data available
                </Text>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button className="w-full" variant="outline">
                <Power className="size-4" />
                Toggle Power
              </Button>
              <Button className="w-full" variant="outline">
                <Icons.Settings size="sm" />
                Configure
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dynamic Sensor Widgets */}
      {sensors.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sensors.map((sensor) => (
            <SensorWidget
              deviceId={deviceId}
              key={sensor.key}
              sensor={sensor}
            />
          ))}
        </div>
      )}

      {/* Placeholder when no sensors are available */}
      {!isHueLight && sensors.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Sensor Data</CardTitle>
          </CardHeader>
          <CardContent>
            <Text className="text-center py-8" variant="muted">
              No sensor data available for this device
            </Text>
          </CardContent>
        </Card>
      )}
    </>
  );
}

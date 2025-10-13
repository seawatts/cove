import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { H2, Text } from '@cove/ui/custom/typography';
import { Power } from 'lucide-react';
import { Suspense } from 'react';
import { HueLightControls } from './_components/hue-light-controls';

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
  // TODO: Fetch device from tRPC
  const device = {
    deviceType: 'light',
    id: deviceId,
    name: 'Example Device',
    online: true,
    protocol: 'hue', // or 'esphome', etc.
    room: 'Living Room',
    state: {
      brightness: 80,
      color_temp: 366,
      hue: 10000,
      on: true,
      saturation: 200,
    },
    type: 'sensor',
  };

  const isHueLight = device.protocol === 'hue' && device.deviceType === 'light';

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
          {device.type} • {device.room}
        </Text>
      </div>

      {isHueLight ? (
        <HueLightControls deviceId={deviceId} lightState={device.state} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Current State</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {Object.entries(device.state).map(([key, value]) => (
                <div className="grid grid-cols-[120px_1fr] gap-2" key={key}>
                  <Text className="capitalize" variant="muted">
                    {key}:
                  </Text>
                  <Text>{String(value)}</Text>
                </div>
              ))}
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

      <Card>
        <CardHeader>
          <CardTitle>History (Last 24 Hours)</CardTitle>
        </CardHeader>
        <CardContent>
          <Text className="text-center py-8" variant="muted">
            Historical charts coming soon
          </Text>
        </CardContent>
      </Card>
    </>
  );
}

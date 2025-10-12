'use client';
import { api } from '@acme/api/client';
import { Badge } from '@acme/ui/badge';
import { Button } from '@acme/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@acme/ui/card';
import { Icons } from '@acme/ui/icons';
import { cn } from '@acme/ui/lib/utils';
import { H1, Text } from '@acme/ui/typography';
import { Suspense } from 'react';

interface DevicePageProps {
  params: {
    deviceId: string;
  };
}

export default function DevicePage({ params }: DevicePageProps) {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <a href="/devices">
              <Icons.ArrowLeft className="size-4" />
              <span className="sr-only">Back to devices</span>
            </a>
          </Button>
          <H1>Device Details</H1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon">
            <Icons.Settings className="size-4" />
            <span className="sr-only">Device settings</span>
          </Button>
          <Button variant="destructive" size="icon">
            <Icons.Delete className="size-4" />
            <span className="sr-only">Delete device</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Suspense
            fallback={
              <div className="h-[200px] flex items-center justify-center">
                <Icons.Spinner className="size-6 animate-spin text-primary" />
              </div>
            }
          >
            <DeviceInfo deviceId={params.deviceId} />
          </Suspense>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between">
                <Text>Power</Text>
                <Button variant="outline" size="icon">
                  <Icons.CircleStop className="size-4" />
                  <span className="sr-only">Toggle power</span>
                </Button>
              </div>

              <div className="space-y-2">
                <Text>Brightness</Text>
                <div className="h-4 bg-secondary rounded-full">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: '50%' }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Text>Color</Text>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    '#FF0000',
                    '#00FF00',
                    '#0000FF',
                    '#FFFF00',
                    '#FF00FF',
                    '#00FFFF',
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        'size-8 rounded-full border-2 border-transparent',
                        'hover:border-primary focus:border-primary focus:outline-none',
                      )}
                      style={{ backgroundColor: color }}
                    >
                      <span className="sr-only">Select color {color}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DeviceInfo({ deviceId }: { deviceId: string }) {
  const { data: devices } = api.useQuery(['devices']);
  const device = devices?.find((d) => d.id === deviceId);

  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <Icons.AlertCircle className="size-8 text-muted" />
        <Text>Device not found</Text>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {device.metadata.icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={device.metadata.icon_url}
                alt={device.friendly_name}
                className="size-8 rounded-sm object-contain"
              />
            ) : (
              <Icons.AlertCircle className="size-8 text-muted" />
            )}
            <div>
              <CardTitle>{device.friendly_name}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                device.status === 'Online'
                  ? 'default'
                  : device.status === 'Offline'
                    ? 'destructive'
                    : 'outline'
              }
            >
              {device.status}
            </Badge>
            <Badge variant="outline">{device.protocol}</Badge>
            {device.categories.map((category) => (
              <Badge key={category} variant="secondary">
                {category}
              </Badge>
            ))}
          </div>

          {device.location.room && (
            <div>
              <Text className="font-medium mb-2">Location</Text>
              <Text className="text-muted-foreground">
                {device.location.room}
                {device.location.floor && ` • ${device.location.floor}`}
                {device.location.zone && ` • ${device.location.zone}`}
              </Text>
            </div>
          )}

          <div>
            <Text className="font-medium mb-2">Last Online</Text>
            <Text className="text-muted-foreground">
              {device.last_online
                ? new Date(device.last_online).toLocaleString()
                : 'Never'}
            </Text>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

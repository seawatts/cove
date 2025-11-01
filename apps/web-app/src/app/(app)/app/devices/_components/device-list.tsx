'use client';

import { Badge } from '@cove/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { hubApi } from '~/lib/hub-trpc';

export function DeviceList() {
  const { data: home } = hubApi.home.get.useQuery();
  const { data: devices = [], isLoading } = hubApi.device.list.useQuery(
    { homeId: home?.id || '' },
    { enabled: !!home?.id },
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-8 items-center justify-center text-center">
          <Icons.Spinner className="animate-spin size-8" variant="muted" />
          <Text variant="muted">Loading devices...</Text>
        </CardContent>
      </Card>
    );
  }

  if (devices.length === 0) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-8 items-center justify-center text-center">
          <Lightbulb className="size-8 text-muted-foreground" />
          <div className="grid gap-2">
            <Text>No devices found</Text>
            <Text variant="muted">
              Devices will appear here automatically when your hub discovers
              them on your network.
            </Text>
            <Text className="text-sm" variant="muted">
              Make sure your hub is running and connected to the same network as
              your devices.
            </Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {devices.map((device) => (
        <Link href={`/app/devices/${device.id}`} key={device.id}>
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="grid grid-cols-[1fr_auto] items-center gap-4">
                <span>{device.name || device.id}</span>
                <Badge variant="default">
                  {device.lastSeen ? 'Online' : 'Offline'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {device.vendor && (
                <Text variant="muted">Vendor: {device.vendor}</Text>
              )}
              {device.model && (
                <Text variant="muted">Model: {device.model}</Text>
              )}
              {device.protocol && (
                <Text variant="muted">Protocol: {device.protocol}</Text>
              )}
              {device.ip && (
                <Text variant="muted">
                  IP: <span className="font-mono text-sm">{device.ip}</span>
                </Text>
              )}
              {device.room && (
                <Text variant="muted">Room: {device.room.name}</Text>
              )}
              {device.entities && device.entities.length > 0 && (
                <Text variant="muted">
                  {device.entities.length} entit
                  {device.entities.length === 1 ? 'y' : 'ies'}
                </Text>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

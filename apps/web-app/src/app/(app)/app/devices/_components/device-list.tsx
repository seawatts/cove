'use client';

import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { Lightbulb } from 'lucide-react';
import Link from 'next/link';

export function DeviceList() {
  // TODO: Fetch real devices from Supabase
  const devices: Array<{
    id: string;
    name: string;
    type: string;
    online: boolean;
    room?: string;
  }> = [];

  if (devices.length === 0) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-8 items-center justify-center text-center">
          <Lightbulb className="size-8 text-muted-foreground" />
          <div className="grid gap-2">
            <Text>No devices found</Text>
            <Text variant="muted">
              Start by discovering devices on your network
            </Text>
          </div>
          <Link href="/app/devices/discover">
            <Button>
              <Icons.Search size="sm" />
              Discover Devices
            </Button>
          </Link>
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
                <span>{device.name}</span>
                <Badge variant={device.online ? 'default' : 'destructive'}>
                  {device.online ? 'Online' : 'Offline'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Text variant="muted">Type: {device.type}</Text>
              {device.room && <Text variant="muted">Room: {device.room}</Text>}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

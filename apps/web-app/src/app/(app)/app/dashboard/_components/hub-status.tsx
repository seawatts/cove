'use client';

import { Badge } from '@cove/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { Lightbulb, Package, Server } from 'lucide-react';

export function HubStatus() {
  // TODO: Fetch real hub status from Supabase
  const hub = {
    devicesConnected: 0,
    name: 'Cove Hub',
    online: true,
    version: '0.1.0',
  };

  return (
    <Card>
      <CardHeader className="grid grid-cols-[1fr_auto] items-center gap-4">
        <CardTitle>Hub Status</CardTitle>
        <Badge variant={hub.online ? 'default' : 'destructive'}>
          {hub.online ? 'Online' : 'Offline'}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
            <Server className="size-4 text-muted-foreground" />
            <Text variant="muted">{hub.name}</Text>
          </div>
          <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
            <Package className="size-4 text-muted-foreground" />
            <Text variant="muted">Version {hub.version}</Text>
          </div>
          <div className="grid grid-cols-[24px_1fr] gap-2 items-center">
            <Lightbulb className="size-4 text-muted-foreground" />
            <Text variant="muted">
              {hub.devicesConnected} devices connected
            </Text>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

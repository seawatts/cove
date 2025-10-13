'use client';

import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { RefreshCw } from 'lucide-react';

export function HubDetails() {
  // TODO: Fetch real hub data from Supabase
  const hub = {
    id: 'hub_1',
    ipAddress: '192.168.1.100',
    lastSeen: new Date(),
    name: 'Cove Hub',
    online: true,
    systemInfo: {
      arch: 'arm64',
      memory: { free: 3072, total: 4096, used: 1024 },
      platform: 'linux',
      uptime: 86400,
    },
    version: '0.1.0',
  };

  const uptimeDays = Math.floor((hub.systemInfo?.uptime || 0) / 86400);
  const memoryUsedPercent = hub.systemInfo?.memory
    ? Math.floor(
        (hub.systemInfo.memory.used / hub.systemInfo.memory.total) * 100,
      )
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="grid grid-cols-[1fr_auto] items-center gap-4">
          <CardTitle>Hub Information</CardTitle>
          <Badge variant={hub.online ? 'default' : 'destructive'}>
            {hub.online ? 'Online' : 'Offline'}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Text variant="muted">Name:</Text>
              <Text>{hub.name}</Text>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Text variant="muted">Version:</Text>
              <Text>{hub.version}</Text>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Text variant="muted">IP Address:</Text>
              <Text className="font-mono text-sm">{hub.ipAddress}</Text>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Text variant="muted">Platform:</Text>
              <Text>
                {hub.systemInfo?.platform} ({hub.systemInfo?.arch})
              </Text>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Text variant="muted">Uptime:</Text>
              <Text>{uptimeDays} days</Text>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Resources</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <div className="grid gap-1">
              <div className="grid grid-cols-[1fr_auto] items-center">
                <Text variant="muted">Memory Usage</Text>
                <Text>{memoryUsedPercent}%</Text>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${memoryUsedPercent}%` }}
                />
              </div>
              <Text className="text-xs" variant="muted">
                {hub.systemInfo?.memory.used}MB / {hub.systemInfo?.memory.total}
                MB
              </Text>
            </div>
          </div>

          <div className="grid gap-2 pt-4 border-t">
            <Button className="w-full" variant="outline">
              <RefreshCw className="size-4" />
              Check for Updates
            </Button>
            <Button className="w-full" variant="outline">
              <Icons.Settings size="sm" />
              Hub Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { hubApi } from '@cove/api/hub/react';
import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { RefreshCw } from 'lucide-react';

export function HubDetails() {
  const {
    data: status,
    isLoading,
    refetch,
  } = hubApi.health.getStatus.useQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: home } = hubApi.home.get.useQuery(undefined, {
    enabled: !!status,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-6">
          <div className="grid gap-2">
            <Icons.Spinner
              className="animate-spin"
              size="lg"
              variant="primary"
            />
            <Text variant="muted">Loading hub details...</Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-6">
          <div className="grid gap-2">
            <Text className="text-lg font-semibold">Hub Unavailable</Text>
            <Text variant="muted">
              Unable to connect to hub. Make sure it's running and accessible at{' '}
              {process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3200'}
            </Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Hub Status</CardTitle>
            <Button onClick={() => refetch()} size="sm" variant="ghost">
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <Text variant="muted">Status</Text>
            <Badge
              variant={status.status === 'healthy' ? 'default' : 'destructive'}
            >
              {status.status}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <Text variant="muted">Hub ID</Text>
            <Text className="font-mono text-sm">{status.hubId}</Text>
          </div>
          {home && (
            <div className="flex items-center justify-between">
              <Text variant="muted">Home</Text>
              <Text>{home.name}</Text>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {Object.entries(status.components).map(([key, value]) => (
            <div className="flex items-center justify-between" key={key}>
              <Text variant="muted">{key}</Text>
              <Badge variant={value ? 'default' : 'destructive'}>
                {value ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

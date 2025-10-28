'use client';

import { api } from '@cove/api/react';
import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export function DeviceList() {
  const { data: home } = api.home.get.useQuery();
  const {
    data: devices = [],
    isLoading,
    refetch,
  } = api.device.list.useQuery(
    { homeId: home?.id || '' },
    { enabled: !!home?.id },
  );
  const cleanupMutation = api.device.cleanupDuplicates.useMutation({
    onError: (error) => {
      toast.error(`Failed to cleanup duplicates: ${error.message}`);
    },
    onSuccess: (result) => {
      if (result.deletedCount > 0) {
        toast.success(result.message);
        refetch();
      } else {
        toast.info('No duplicate devices found');
      }
    },
  });

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
      {devices.length > 1 && (
        <div className="grid justify-end">
          <Button
            disabled={cleanupMutation.isPending}
            onClick={() => cleanupMutation.mutate({ homeId: home?.id || '' })}
            size="sm"
            variant="outline"
          >
            {cleanupMutation.isPending ? (
              <>
                <Icons.Spinner className="animate-spin" size="sm" />
                Cleaning up...
              </>
            ) : (
              <>
                <Icons.Trash size="sm" />
                Remove Duplicates
              </>
            )}
          </Button>
        </div>
      )}
      {devices.map((device) => (
        <Link href={`/app/devices/${device.deviceId}`} key={device.deviceId}>
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="grid grid-cols-[1fr_auto] items-center gap-4">
                <span>{device.name || device.deviceId}</span>
                <Badge variant="default">Online</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Text variant="muted">
                Type: {String(device.metadata?.deviceType || 'unknown')}
              </Text>
              {Boolean(device.metadata?.protocol) &&
                typeof device.metadata?.protocol === 'string' && (
                  <Text variant="muted">
                    Protocol: {String(device.metadata?.protocol)}
                  </Text>
                )}
              {device.room && (
                <Text variant="muted">Room: {device.room.name}</Text>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

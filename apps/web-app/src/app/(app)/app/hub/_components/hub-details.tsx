'use client';

import { hubApi } from '@cove/api/hub/react';
import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { Download, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function HubDetails() {
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

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

  const { data: currentVersion } = hubApi.system.getCurrentVersion.useQuery();

  const {
    data: updateCheck,
    refetch: checkForUpdates,
    isLoading: isCheckingForUpdates,
  } = hubApi.system.checkForUpdates.useQuery(undefined, {
    enabled: false, // Don't auto-fetch
  });

  const upgradeMutation = hubApi.system.upgradeHub.useMutation({
    onError: (error) => {
      toast.error('Upgrade Failed', {
        description: error.message,
      });
    },
    onSuccess: () => {
      toast.success('Upgrade Successful', {
        description: 'Hub is restarting with the new version...',
      });
      // Refetch status after a delay to show the new version
      setTimeout(() => {
        refetch();
      }, 5000);
    },
  });

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      const result = await checkForUpdates();
      if (result.data?.updateAvailable) {
        toast.info('Update Available', {
          description: `Version ${result.data.latestVersion} is available`,
        });
      } else {
        toast.success('Up to Date', {
          description: 'You are running the latest version',
        });
      }
    } catch {
      toast.error('Check Failed', {
        description: 'Failed to check for updates',
      });
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleUpgrade = () => {
    if (
      confirm(
        `Upgrade to version ${updateCheck?.latestVersion}? The hub will restart automatically.`,
      )
    ) {
      upgradeMutation.mutate();
    }
  };

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
          <div className="flex items-center justify-between">
            <Text variant="muted">Version</Text>
            <div className="flex items-center gap-2">
              <Text className="font-mono text-sm">
                {currentVersion?.version || 'Loading...'}
              </Text>
              {updateCheck?.updateAvailable && (
                <Badge variant="secondary">Update available</Badge>
              )}
            </div>
          </div>
          {home && (
            <div className="flex items-center justify-between">
              <Text variant="muted">Home</Text>
              <Text>{home.name}</Text>
            </div>
          )}
          <div className="grid gap-2">
            <Button
              disabled={isCheckingUpdates || isCheckingForUpdates}
              onClick={handleCheckUpdates}
              size="sm"
              variant="outline"
            >
              {isCheckingUpdates || isCheckingForUpdates ? (
                <>
                  <Icons.Spinner className="animate-spin" size="sm" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  Check for Updates
                </>
              )}
            </Button>
            {updateCheck?.updateAvailable && (
              <Button
                disabled={upgradeMutation.isPending}
                onClick={handleUpgrade}
                size="sm"
              >
                {upgradeMutation.isPending ? (
                  <>
                    <Icons.Spinner className="animate-spin" size="sm" />
                    Upgrading...
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    Upgrade to {updateCheck.latestVersion}
                  </>
                )}
              </Button>
            )}
          </div>
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

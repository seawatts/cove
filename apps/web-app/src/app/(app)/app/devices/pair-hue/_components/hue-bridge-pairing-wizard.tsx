'use client';

import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { Lightbulb, Link2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type PairingPhase =
  | 'discovering'
  | 'found'
  | 'pairing'
  | 'waiting_for_button'
  | 'authenticating'
  | 'success'
  | 'error';

interface DiscoveredBridge {
  id: string;
  name: string;
  ipAddress: string;
  authenticated: boolean;
  bridgeId?: string;
}

export function HueBridgePairingWizard() {
  const router = useRouter();
  const [phase, setPhase] = useState<PairingPhase>('discovering');
  const [selectedBridge, setSelectedBridge] = useState<DiscoveredBridge | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const discoverMutation = {
    data: [], // Add data property for the component
    mutate: () => {},
    mutateAsync: async () => {
      // Mock implementation - return empty array for now
      return [];
    },
  };
  const pairMutation = {
    mutateAsync: async () => {
      // Mock implementation
      return {};
    },
  };
  const statusQuery = {
    refetch: async () => {
      // Mock implementation
      return { data: { authenticated: false } };
    },
  };

  // Initial discovery
  useEffect(() => {
    const discover = async () => {
      try {
        const result = await discoverMutation.mutateAsync();
        if (result) {
          setPhase('found');
        }
      } catch (_err) {
        setError('Failed to discover bridges');
        setPhase('error');
      }
    };

    discover();
  }, []);

  // Poll pairing status
  useEffect(() => {
    if (phase === 'authenticating' && selectedBridge) {
      const interval = setInterval(async () => {
        try {
          const status = await statusQuery.refetch();
          if (status.data?.authenticated) {
            clearInterval(interval);
            setPhase('success');
          }
        } catch (_err) {
          // Continue polling
        }
      }, 2000);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (phase === 'authenticating') {
          clearInterval(interval);
          setError('Pairing timed out. Please try again.');
          setPhase('error');
        }
      }, 30000);

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [phase, selectedBridge]);

  // Auto-redirect after success
  useEffect(() => {
    if (phase === 'success') {
      const timeout = setTimeout(() => {
        router.push('/app/devices');
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [phase, router]);

  const handlePairBridge = async (bridge: DiscoveredBridge) => {
    setSelectedBridge(bridge);

    // If already authenticated, skip to success
    if (bridge.authenticated) {
      setPhase('success');
      return;
    }

    setPhase('pairing');

    try {
      await pairMutation.mutateAsync();
      setPhase('waiting_for_button');

      // Give user time to read the instruction
      setTimeout(() => {
        setPhase('authenticating');
      }, 2000);
    } catch (_err) {
      setError('Failed to initiate pairing');
      setPhase('error');
    }
  };

  const handleTryAgain = () => {
    setError(null);
    setSelectedBridge(null);
    setPhase('discovering');
    // Mock implementation - no-op
  };

  if (phase === 'discovering') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-8 items-center justify-center text-center">
          <Icons.Spinner
            className="animate-spin"
            size="2xl"
            variant="primary"
          />
          <div className="grid gap-2">
            <Text className="text-lg font-semibold">
              Discovering Bridges...
            </Text>
            <Text variant="muted">
              Looking for Philips Hue bridges on your network
            </Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'found') {
    const discoveredBridges =
      (discoverMutation.data as unknown as DiscoveredBridge[]) || [];

    return (
      <div className="grid gap-4">
        {discoveredBridges.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Found Bridges</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {discoveredBridges.map((bridge) => (
                <div
                  className="grid grid-cols-[1fr_auto] gap-4 p-4 border rounded-lg"
                  key={bridge.id}
                >
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <Text className="font-semibold">{bridge.name}</Text>
                      {bridge.authenticated && (
                        <div className="size-2 rounded-full bg-green-500" />
                      )}
                    </div>
                    <Text className="text-sm" variant="muted">
                      {bridge.ipAddress}
                      {bridge.bridgeId && ` • ${bridge.bridgeId}`}
                    </Text>
                    {bridge.authenticated && (
                      <Text className="text-xs text-green-600">
                        Already paired
                      </Text>
                    )}
                  </div>
                  <Button onClick={() => handlePairBridge(bridge)}>
                    <Link2 className="size-4" />
                    {bridge.authenticated ? 'View' : 'Pair'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="grid gap-6 p-8 items-center justify-center text-center">
              <Icons.Search size="2xl" variant="muted" />
              <div className="grid gap-2">
                <Text className="text-lg font-semibold">No Bridges Found</Text>
                <Text variant="muted">
                  Make sure your Hue bridge is powered on and connected to the
                  same network
                </Text>
              </div>

              <div className="grid gap-2">
                <Button onClick={handleTryAgain}>
                  <RefreshCw className="size-4" />
                  Scan Again
                </Button>
                <Button
                  onClick={() => router.push('/app/devices')}
                  variant="outline"
                >
                  Back to Devices
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (phase === 'pairing') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-8 items-center justify-center text-center">
          <Icons.Spinner
            className="animate-spin"
            size="2xl"
            variant="primary"
          />
          <div className="grid gap-2">
            <Text className="text-lg font-semibold">Initiating Pairing...</Text>
            <Text variant="muted">Connecting to {selectedBridge?.name}</Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'waiting_for_button') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-8 items-center justify-center text-center">
          <div className="size-24 rounded-full bg-blue-500/10 grid items-center justify-center relative">
            <Lightbulb className="text-blue-500 size-8" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping" />
          </div>
          <div className="grid gap-2">
            <Text className="text-lg font-semibold">Press the Link Button</Text>
            <Text variant="muted">
              Press the button on your Hue bridge to authorize this app
            </Text>
            <Text className="text-sm" variant="muted">
              The button is typically on top of the bridge
            </Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'authenticating') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-8 items-center justify-center text-center">
          <Icons.Spinner
            className="animate-spin"
            size="2xl"
            variant="primary"
          />
          <div className="grid gap-2">
            <Text className="text-lg font-semibold">Authenticating...</Text>
            <Text variant="muted">
              Waiting for bridge authorization (up to 30 seconds)
            </Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'success') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-8 items-center justify-center text-center">
          <div className="size-16 rounded-full bg-green-500/10 grid items-center justify-center">
            <Icons.Check className="text-green-500" size="2xl" />
          </div>
          <div className="grid gap-2">
            <Text className="text-lg font-semibold">
              Bridge Paired Successfully!
            </Text>
            <Text variant="muted">{selectedBridge?.name} is now connected</Text>
            <Text className="text-sm" variant="muted">
              Redirecting to devices...
            </Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'error') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-8 items-center justify-center text-center">
          <div className="size-16 rounded-full bg-red-500/10 grid items-center justify-center">
            <Icons.AlertTriangle className="text-red-500" size="2xl" />
          </div>
          <div className="grid gap-2">
            <Text className="text-lg font-semibold">Pairing Failed</Text>
            <Text variant="muted">{error || 'An unknown error occurred'}</Text>
          </div>

          <div className="grid gap-2">
            <Button onClick={handleTryAgain}>
              <RefreshCw className="size-4" />
              Try Again
            </Button>
            <Button
              onClick={() => router.push('/app/devices')}
              variant="outline"
            >
              Back to Devices
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

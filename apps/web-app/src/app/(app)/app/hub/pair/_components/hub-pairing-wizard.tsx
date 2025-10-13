'use client';

import { Button } from '@cove/ui/button';
import { Card, CardContent } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { Input } from '@cove/ui/input';
import { Label } from '@cove/ui/label';
import { Link2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type PairingPhase = 'scanning' | 'found' | 'manual' | 'pairing' | 'success';

export function HubPairingWizard() {
  const router = useRouter();
  const [phase, setPhase] = useState<PairingPhase>('scanning');
  const [discoveredHubs, setDiscoveredHubs] = useState<
    Array<{
      id: string;
      name: string;
      ipAddress: string;
      version: string;
    }>
  >([]);
  const [manualIp, setManualIp] = useState('');

  // Simulate mDNS discovery
  useState(() => {
    setTimeout(() => {
      // TODO: Implement real mDNS discovery via WebRTC or API call
      setDiscoveredHubs([]);
      setPhase('found');
    }, 2000);
  });

  const pairHub = async (_hubIp: string) => {
    setPhase('pairing');

    // TODO: Call API to pair hub
    // 1. Verify hub is accessible at hubIp
    // 2. Exchange auth tokens
    // 3. Register hub in database

    setTimeout(() => {
      setPhase('success');
      setTimeout(() => {
        router.push('/app/dashboard');
      }, 2000);
    }, 1500);
  };

  if (phase === 'scanning') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-8 items-center justify-center text-center">
          <Icons.Spinner
            className="animate-spin"
            size="2xl"
            variant="primary"
          />
          <div className="grid gap-2">
            <Text className="text-lg font-semibold">Scanning Network...</Text>
            <Text variant="muted">
              Looking for Cove hubs on your local network
            </Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'found') {
    return (
      <div className="grid gap-4">
        {discoveredHubs.length > 0 ? (
          <>
            <Card>
              <CardContent className="grid gap-4 p-6">
                {discoveredHubs.map((hub) => (
                  <div
                    className="grid grid-cols-[1fr_auto] gap-4 p-4 border rounded-lg"
                    key={hub.id}
                  >
                    <div className="grid gap-1">
                      <Text className="font-semibold">{hub.name}</Text>
                      <Text className="text-sm" variant="muted">
                        {hub.ipAddress} • v{hub.version}
                      </Text>
                    </div>
                    <Button onClick={() => pairHub(hub.ipAddress)}>
                      <Link2 className="size-4" />
                      Pair
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="text-center">
              <Button onClick={() => setPhase('manual')} variant="link">
                Enter IP address manually
              </Button>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="grid gap-6 p-8 items-center justify-center text-center">
              <Icons.Search size="2xl" variant="muted" />
              <div className="grid gap-2">
                <Text className="text-lg font-semibold">No Hubs Found</Text>
                <Text variant="muted">
                  Make sure your hub is powered on and connected to the same
                  network
                </Text>
              </div>

              <div className="grid gap-2">
                <Button onClick={() => setPhase('scanning')}>
                  <RefreshCw className="size-4" />
                  Scan Again
                </Button>
                <Button onClick={() => setPhase('manual')} variant="outline">
                  Enter IP Manually
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (phase === 'manual') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ip">Hub IP Address</Label>
              <Input
                id="ip"
                onChange={(e) => setManualIp(e.target.value)}
                placeholder="192.168.1.100"
                type="text"
                value={manualIp}
              />
              <Text className="text-xs" variant="muted">
                Enter the IP address of your Cove hub (found in your router or
                hub display)
              </Text>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button onClick={() => setPhase('found')} variant="outline">
              Back
            </Button>
            <Button disabled={!manualIp} onClick={() => pairHub(manualIp)}>
              <Link2 className="size-4" />
              Pair Hub
            </Button>
          </div>
        </CardContent>
      </Card>
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
            <Text className="text-lg font-semibold">Pairing Hub...</Text>
            <Text variant="muted">Establishing secure connection</Text>
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
              Hub Paired Successfully!
            </Text>
            <Text variant="muted">Redirecting to dashboard...</Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

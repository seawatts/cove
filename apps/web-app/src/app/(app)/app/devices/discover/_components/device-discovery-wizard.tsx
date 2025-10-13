'use client';

import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import { useState } from 'react';

type DiscoveryPhase = 'idle' | 'scanning' | 'found' | 'configuring' | 'error';

interface DiscoveredDevice {
  id: string;
  name: string;
  protocol: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export function DeviceDiscoveryWizard() {
  const [phase, setPhase] = useState<DiscoveryPhase>('idle');
  const [discoveredDevices, setDiscoveredDevices] = useState<
    DiscoveredDevice[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [hubUrl] = useState('http://localhost:3100');

  const startScan = async () => {
    setPhase('scanning');
    setError(null);

    try {
      // Give the hub a moment to discover devices
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Fetch discovered devices from the hub
      const response = await fetch(`${hubUrl}/api/devices/discovered`);

      if (!response.ok) {
        throw new Error('Failed to fetch devices from hub');
      }

      const data = await response.json();
      const devices: DiscoveredDevice[] = (data.devices || []).map(
        (device: any) => ({
          id: `${device.protocol}_${device.ipAddress?.replace(/\./g, '_') || Date.now()}`,
          ipAddress: device.ipAddress,
          metadata: device.metadata,
          name: device.name,
          protocol: device.protocol,
        }),
      );

      setDiscoveredDevices(devices);
      setPhase(devices.length > 0 ? 'found' : 'idle');

      if (devices.length === 0) {
        setError(
          'No devices found on the network. Make sure your devices are powered on and connected.',
        );
      }
    } catch (err) {
      console.error('Discovery error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to discover devices',
      );
      setPhase('error');
    }
  };

  const addDevice = (deviceId: string) => {
    // TODO: Add device to database via tRPC
    console.log('Adding device:', deviceId);
  };

  if (phase === 'idle') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-8">
          <div className="grid gap-4 items-center justify-center text-center">
            <Icons.Search size="2xl" variant="primary" />
            <div className="grid gap-2">
              <Text className="text-lg font-semibold">
                Ready to Discover Devices
              </Text>
              <Text variant="muted">
                Cove will scan your network for compatible devices using mDNS
                and other protocols
              </Text>
            </div>
          </div>

          <div className="grid gap-2">
            <Text className="text-sm" variant="muted">
              Supported protocols:
            </Text>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                'ESPHome',
                'Matter',
                'Zigbee',
                'Z-Wave',
                'HomeKit',
                'MQTT',
                'WiFi',
                'Bluetooth',
              ].map((protocol) => (
                <div
                  className="text-xs p-2 bg-muted rounded text-center"
                  key={protocol}
                >
                  {protocol}
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={startScan} size="lg">
            <Icons.Search size="sm" />
            Start Discovery
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'scanning') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-8">
          <div className="grid gap-4 items-center justify-center text-center">
            <Icons.Spinner
              className="animate-spin"
              size="2xl"
              variant="primary"
            />
            <div className="grid gap-2">
              <Text className="text-lg font-semibold">Scanning Network...</Text>
              <Text variant="muted">
                This may take up to a minute. Please wait.
              </Text>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'error') {
    return (
      <Card>
        <CardContent className="grid gap-6 p-8">
          <div className="grid gap-4 items-center justify-center text-center">
            <Icons.AlertCircle size="2xl" variant="destructive" />
            <div className="grid gap-2">
              <Text className="text-lg font-semibold">Discovery Error</Text>
              <Text variant="muted">
                {error || 'An error occurred during discovery'}
              </Text>
              <Text className="text-xs" variant="muted">
                Make sure the hub daemon is running on localhost:3100
              </Text>
            </div>
          </div>
          <Button className="w-full" onClick={() => setPhase('idle')}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === 'found') {
    return (
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Found {discoveredDevices.length} device(s)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {discoveredDevices.map((device) => (
              <div
                className="grid grid-cols-[1fr_auto] gap-4 p-4 border rounded-lg"
                key={device.id}
              >
                <div className="grid gap-1">
                  <Text className="font-semibold">{device.name}</Text>
                  <Text className="text-sm" variant="muted">
                    {device.protocol} • {device.ipAddress}
                  </Text>
                  {device.metadata?.port && (
                    <Text className="text-xs" variant="muted">
                      Port: {device.metadata.port}
                    </Text>
                  )}
                </div>
                <Button onClick={() => addDevice(device.id)}>
                  <Icons.Plus size="sm" />
                  Add
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Button onClick={() => startScan()} variant="outline">
            Scan Again
          </Button>
          <Button onClick={() => setPhase('configuring')}>
            Configure Devices
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

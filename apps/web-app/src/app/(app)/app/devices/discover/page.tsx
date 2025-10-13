import { H2, Text } from '@cove/ui/custom/typography';
import { Suspense } from 'react';
import { DeviceDiscoveryWizard } from './_components/device-discovery-wizard';

export default function DiscoverDevicesPage() {
  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-2">
        <H2>Discover Devices</H2>
        <Text variant="muted">
          Scan your network for compatible smart home devices
        </Text>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <DeviceDiscoveryWizard />
      </Suspense>
    </div>
  );
}

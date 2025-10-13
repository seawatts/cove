import { H2, Text } from '@cove/ui/custom/typography';
import { Suspense } from 'react';
import { DeviceList } from './_components/device-list';

export default function DevicesPage() {
  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-2">
        <H2>Devices</H2>
        <Text variant="muted">Manage all your smart home devices</Text>
      </div>

      <Suspense fallback={<div>Loading devices...</div>}>
        <DeviceList />
      </Suspense>
    </div>
  );
}

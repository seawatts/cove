import { H2, Text } from '@cove/ui/custom/typography';
import { Suspense } from 'react';
import { HubDetails } from './_components/hub-details';
import { HubLogs } from './_components/hub-logs';

export default function HubPage() {
  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-2">
        <H2>Hub Management</H2>
        <Text variant="muted">Monitor and configure your Cove hub</Text>
      </div>

      <Suspense fallback={<div>Loading hub details...</div>}>
        <HubDetails />
      </Suspense>

      <Suspense fallback={<div>Loading logs...</div>}>
        <HubLogs />
      </Suspense>
    </div>
  );
}

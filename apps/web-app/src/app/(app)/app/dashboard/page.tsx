import { H2, Text } from '@cove/ui/custom/typography';
import { Suspense } from 'react';
import { HubStatus } from './_components/hub-status';
import { QuickActions } from './_components/quick-actions';
import { RoomsGrid } from './_components/rooms-grid';

export default function DashboardPage() {
  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-2">
        <H2>Dashboard</H2>
        <Text variant="muted">Welcome to your Cove home automation system</Text>
      </div>

      <Suspense fallback={<div>Loading hub status...</div>}>
        <HubStatus />
      </Suspense>

      <Suspense fallback={<div>Loading quick actions...</div>}>
        <QuickActions />
      </Suspense>

      <Suspense fallback={<div>Loading rooms...</div>}>
        <RoomsGrid />
      </Suspense>
    </div>
  );
}

import { H2, Text } from '@cove/ui/custom/typography';
import { Suspense } from 'react';
import { HubPairingWizard } from './_components/hub-pairing-wizard';

export default function HubPairPage() {
  return (
    <div className="grid gap-6 p-6 max-w-2xl mx-auto">
      <div className="grid gap-2 text-center">
        <H2>Pair Your Hub</H2>
        <Text variant="muted">
          We'll automatically discover hubs on your network
        </Text>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <HubPairingWizard />
      </Suspense>
    </div>
  );
}

import { H2, Text } from '@cove/ui/custom/typography';
import { Suspense } from 'react';
import { HueBridgePairingWizard } from './_components/hue-bridge-pairing-wizard';

export default function HuePairPage() {
  return (
    <div className="grid gap-6 p-6 max-w-2xl mx-auto">
      <div className="grid gap-2 text-center">
        <H2>Pair Philips Hue Bridge</H2>
        <Text variant="muted">
          We'll automatically discover Hue bridges on your network
        </Text>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <HueBridgePairingWizard />
      </Suspense>
    </div>
  );
}

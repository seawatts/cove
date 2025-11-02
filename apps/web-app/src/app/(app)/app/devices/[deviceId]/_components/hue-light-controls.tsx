'use client';

import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
import { ControlGrid } from './control-grid';

interface HueLightControlsProps {
  entities: EntityWithStateAndCapabilities[];
}

export function HueLightControls({ entities }: HueLightControlsProps) {
  return (
    <ControlGrid deviceId="hue-bridge" entities={entities} showCharts={true} />
  );
}

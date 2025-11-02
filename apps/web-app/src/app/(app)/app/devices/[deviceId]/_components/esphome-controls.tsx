'use client';

import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
import { ControlGrid } from './control-grid';

interface ESPHomeControlsProps {
  deviceId: string;
  entities: EntityWithStateAndCapabilities[];
}

export function ESPHomeControls({ deviceId, entities }: ESPHomeControlsProps) {
  return (
    <ControlGrid deviceId={deviceId} entities={entities} showCharts={true} />
  );
}

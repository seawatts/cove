'use client';

import { ControlGrid } from './control-grid';

interface ESPHomeControlsProps {
  deviceId: string;
  entities: Array<{
    entityId: string;
    kind: string;
    key: string;
    deviceClass?: string;
    name?: string | null;
    capabilities: Array<Record<string, unknown>>;
    currentState?: {
      state: string;
      attrs?: Record<string, unknown>;
      updatedAt: Date;
    } | null;
  }>;
}

export function ESPHomeControls({ deviceId, entities }: ESPHomeControlsProps) {
  return (
    <ControlGrid deviceId={deviceId} entities={entities} showCharts={true} />
  );
}

'use client';

import { ControlGrid } from './control-grid';

interface HueLightControlsProps {
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

export function HueLightControls({ entities }: HueLightControlsProps) {
  return (
    <ControlGrid deviceId="hue-bridge" entities={entities} showCharts={true} />
  );
}

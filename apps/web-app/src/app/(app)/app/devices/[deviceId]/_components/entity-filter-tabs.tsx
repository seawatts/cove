'use client';

import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
import { EntityKind } from '@cove/types';
import { Badge } from '@cove/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@cove/ui/tabs';
import { useQueryState } from 'nuqs';
import * as React from 'react';

// Helper to convert string to EntityKind with 'all' default
function toEntityKind(value: string): EntityKind | 'all' {
  if (value === 'all') return 'all';
  return (
    Object.values(EntityKind).includes(value as EntityKind) ? value : 'all'
  ) as EntityKind | 'all';
}

// Human-readable labels for entity kinds
const entityKindLabels: Record<EntityKind | 'all', string> = {
  all: 'All',
  [EntityKind.Light]: 'Lights',
  [EntityKind.Switch]: 'Switches',
  [EntityKind.Sensor]: 'Sensors',
  [EntityKind.BinarySensor]: 'Binary Sensors',
  [EntityKind.Lock]: 'Locks',
  [EntityKind.Camera]: 'Cameras',
  [EntityKind.Speaker]: 'Speakers',
  [EntityKind.Fan]: 'Fans',
  [EntityKind.Outlet]: 'Outlets',
  [EntityKind.Thermostat]: 'Thermostats',
  [EntityKind.Cover]: 'Covers',
  [EntityKind.Climate]: 'Climate',
  [EntityKind.Number]: 'Numbers',
  [EntityKind.Select]: 'Select',
  [EntityKind.Button]: 'Buttons',
  [EntityKind.Text]: 'Text',
  [EntityKind.TextSensor]: 'Text Sensors',
  [EntityKind.Time]: 'Time',
  [EntityKind.Date]: 'Date',
  [EntityKind.DateTime]: 'DateTime',
  [EntityKind.Color]: 'Color',
  [EntityKind.MediaPlayer]: 'Media Players',
  [EntityKind.Siren]: 'Sirens',
  [EntityKind.AlarmControlPanel]: 'Alarm Panels',
  [EntityKind.Valve]: 'Valves',
  [EntityKind.Update]: 'Updates',
  [EntityKind.Event]: 'Events',
  [EntityKind.Other]: 'Other',
};

interface EntityFilterTabsProps {
  entities: EntityWithStateAndCapabilities[];
}

export function EntityFilterTabs({ entities }: EntityFilterTabsProps) {
  const [entityFilter, setEntityFilter] = useQueryState('entityFilter', {
    defaultValue: 'all',
    parse: toEntityKind,
    serialize: (value) => value,
  });

  // Calculate entity counts for each kind
  const entityCounts = React.useMemo(() => {
    // Initialize counts dynamically from entityKindLabels
    const counts = Object.keys(entityKindLabels).reduce(
      (acc, kind) => {
        acc[kind as EntityKind | 'all'] = 0;
        return acc;
      },
      {} as Record<EntityKind | 'all', number>,
    );

    // Set 'all' count to total entities
    counts.all = entities.length;

    // Count each entity by kind
    for (const entity of entities) {
      const kind = toEntityKind(entity.kind);
      if (kind !== 'all') {
        counts[kind]++;
      }
    }

    return counts;
  }, [entities]);

  // Get available entity kinds (only show tabs with entities)
  const availableKinds = React.useMemo(() => {
    return (Object.keys(entityCounts) as Array<EntityKind | 'all'>)
      .filter((kind) => (entityCounts[kind] ?? 0) > 0)
      .sort((a, b) => {
        // Keep 'all' first, then sort by count descending
        if (a === 'all') return -1;
        if (b === 'all') return 1;
        return (entityCounts[b] ?? 0) - (entityCounts[a] ?? 0);
      });
  }, [entityCounts]);

  return (
    <Tabs
      onValueChange={(value: string) => setEntityFilter(toEntityKind(value))}
      value={entityFilter}
    >
      <TabsList>
        {availableKinds.map((kind) => {
          const count = entityCounts[kind];
          return (
            <TabsTrigger key={kind} value={kind}>
              {entityKindLabels[kind]}
              {count > 0 && (
                <Badge className="text-xs" variant="secondary">
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

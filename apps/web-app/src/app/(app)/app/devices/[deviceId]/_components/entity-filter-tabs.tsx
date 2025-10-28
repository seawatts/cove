'use client';

import { Badge } from '@cove/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@cove/ui/tabs';
import { useQueryState } from 'nuqs';
import * as React from 'react';

type EntityKind =
  | 'all'
  | 'light'
  | 'sensor'
  | 'binary_sensor'
  | 'switch'
  | 'climate'
  | 'cover'
  | 'lock'
  | 'camera'
  | 'speaker'
  | 'fan'
  | 'outlet'
  | 'thermostat'
  | 'number'
  | 'select'
  | 'button'
  | 'text'
  | 'time'
  | 'date'
  | 'datetime'
  | 'color'
  | 'other';

interface EntityFilterTabsProps {
  entities: Array<{
    kind: string;
    entityId: string;
  }>;
}

const entityKindLabels: Record<EntityKind, string> = {
  all: 'All',
  binary_sensor: 'Binary Sensors',
  button: 'Buttons',
  camera: 'Cameras',
  climate: 'Climate',
  color: 'Color',
  cover: 'Covers',
  date: 'Date',
  datetime: 'DateTime',
  fan: 'Fans',
  light: 'Lights',
  lock: 'Locks',
  number: 'Numbers',
  other: 'Other',
  outlet: 'Outlets',
  select: 'Selects',
  sensor: 'Sensors',
  speaker: 'Speakers',
  switch: 'Switches',
  text: 'Text',
  thermostat: 'Thermostats',
  time: 'Time',
};

export function EntityFilterTabs({ entities }: EntityFilterTabsProps) {
  const [entityFilter, setEntityFilter] = useQueryState('entityFilter', {
    defaultValue: 'all',
    parse: (value) => (value as EntityKind) || 'all',
    serialize: (value) => value,
  });

  // Calculate entity counts for each kind
  const entityCounts = React.useMemo(() => {
    const counts: Record<EntityKind, number> = {
      all: entities.length,
      binary_sensor: 0,
      button: 0,
      camera: 0,
      climate: 0,
      color: 0,
      cover: 0,
      date: 0,
      datetime: 0,
      fan: 0,
      light: 0,
      lock: 0,
      number: 0,
      other: 0,
      outlet: 0,
      select: 0,
      sensor: 0,
      speaker: 0,
      switch: 0,
      text: 0,
      thermostat: 0,
      time: 0,
    };

    entities.forEach((entity) => {
      const kind = entity.kind as EntityKind;
      if (counts[kind] !== undefined) {
        counts[kind]++;
      } else {
        counts.other++;
      }
    });

    return counts;
  }, [entities]);

  // Get available entity kinds (only show tabs with entities)
  const availableKinds = React.useMemo(() => {
    return Object.entries(entityCounts)
      .filter(([_, count]) => count > 0)
      .map(([kind]) => kind as EntityKind)
      .sort((a, b) => {
        // Keep 'all' first, then sort by count descending
        if (a === 'all') return -1;
        if (b === 'all') return 1;
        return entityCounts[b] - entityCounts[a];
      });
  }, [entityCounts]);

  return (
    <Tabs
      onValueChange={(value: string) => setEntityFilter(value as EntityKind)}
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

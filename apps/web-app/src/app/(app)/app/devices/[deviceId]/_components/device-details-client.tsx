'use client';

import type { SensorMetadata } from '@cove/types/widget';
import { Card, CardContent } from '@cove/ui/card';
import { Text } from '@cove/ui/custom/typography';
import { getEntityDisplayName } from '@cove/utils';
import { useQueryState } from 'nuqs';
import { ControlGrid } from './control-grid';
import { EntityFilterTabs } from './entity-filter-tabs';
import { SensorWidget } from './sensor-widget';
import { TimeRangeSelector } from './time-range-selector';

interface Entity {
  entityId: string;
  kind: string;
  key: string;
  deviceClass?: string | null;
  name?: string | null;
  capabilities: Array<Record<string, unknown>>;
  currentState?: {
    state: string;
    attrs?: Record<string, unknown>;
    updatedAt: Date;
  } | null;
}

interface DeviceDetailsClientProps {
  entities: Entity[];
  deviceId: string;
}

export function DeviceDetailsClient({
  entities,
  deviceId,
}: DeviceDetailsClientProps) {
  const [entityFilter] = useQueryState('entityFilter', {
    defaultValue: 'all',
    parse: (value) => (value as string) || 'all',
  });

  // Filter entities based on selected tab
  const filteredEntities = entities.filter((entity) => {
    if (entityFilter === 'all') return true;
    if (entityFilter === 'sensor')
      return entity.kind === 'sensor' || entity.kind === 'binary_sensor';
    return entity.kind === entityFilter;
  });

  // Convert entities to sensor metadata for widgets
  const sensors: SensorMetadata[] = entities
    .filter((entity) => {
      // Only include actual sensor entities, not controllable entities
      if (entity.kind !== 'sensor' && entity.kind !== 'binary_sensor') {
        return false;
      }

      // Filter out system/status sensors
      const systemDeviceClasses = [
        'connectivity',
        'duration',
        'memory',
        'signal_strength',
      ];
      if (
        entity.deviceClass &&
        systemDeviceClasses.includes(entity.deviceClass)
      ) {
        return false;
      }

      return true;
    })
    .map((entity) => {
      const currentValue = entity.currentState?.state;
      const isBoolean = typeof currentValue === 'boolean';

      // Extract unit from numeric capability
      const numericCapability = entity.capabilities.find(
        (cap) => cap.type === 'numeric',
      ) as { unit?: string } | undefined;
      const unit = numericCapability?.unit;

      return {
        currentValue,
        entityId: entity.entityId,
        key: entity.key,
        lastChanged: entity.currentState?.updatedAt || new Date(),
        name: getEntityDisplayName({
          deviceClass: entity.deviceClass,
          key: entity.key,
          name: entity.name,
        }),
        type: isBoolean ? 'binary' : 'continuous', // Default to continuous for all non-binary sensors
        unit,
      };
    });

  // Filter sensors based on entity filter
  const filteredSensors = sensors.filter((sensor) => {
    if (entityFilter === 'all') return true;
    if (entityFilter === 'sensor') return true;
    if (entityFilter === 'binary_sensor') return sensor.type === 'binary';
    return false;
  });

  // Determine what to show based on filter
  const isControlEntity = [
    'all',
    'light',
    'switch',
    'climate',
    'cover',
  ].includes(entityFilter);
  const isSensorEntity = ['all', 'sensor', 'binary_sensor'].includes(
    entityFilter,
  );

  return (
    <>
      {/* Global Time Range Selector */}
      <div className="flex justify-between items-center">
        <Text className="text-sm font-medium">Time Range</Text>
        <TimeRangeSelector />
      </div>

      {/* Entity Filter Tabs */}
      <EntityFilterTabs entities={entities} />

      {/* Filtered content based on entityFilter */}
      {isControlEntity && (
        <ControlGrid
          deviceId={deviceId}
          entities={filteredEntities}
          showCharts={entityFilter === 'all'}
        />
      )}

      {/* Sensor widgets - show in both 'all' and 'sensors' views */}
      {isSensorEntity && filteredSensors.length > 0 && (
        <div>
          <div className="mb-4">
            <Text className="text-lg font-semibold">Sensor Data</Text>
            <Text className="text-sm text-muted-foreground">
              {filteredSensors.length} sensor
              {filteredSensors.length !== 1 ? 's' : ''}
            </Text>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSensors.map((sensor) => (
              <SensorWidget
                deviceId={deviceId}
                key={sensor.key}
                mode="full"
                sensor={sensor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no entities match filter */}
      {filteredEntities.length === 0 && (
        <Card>
          <CardContent className="grid gap-4 p-8 items-center justify-center text-center">
            <Text variant="muted">
              No entities found for the selected filter
            </Text>
          </CardContent>
        </Card>
      )}
    </>
  );
}

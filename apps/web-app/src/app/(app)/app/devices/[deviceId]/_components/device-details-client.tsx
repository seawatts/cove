'use client';

import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
import { entityToSensorMetadata, isUserFacingSensor } from '@cove/db/hub';
import { Card, CardContent } from '@cove/ui/card';
import { Text } from '@cove/ui/custom/typography';
import { useQueryState } from 'nuqs';
import { ControlGrid } from './control-grid';
import { EntityFilterTabs } from './entity-filter-tabs';
import { SensorWidget } from './sensor-widget';
import { TimeRangeSelector } from './time-range-selector';

interface DeviceDetailsClientProps {
  entities: EntityWithStateAndCapabilities[];
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
  const sensors = entities
    .filter((entity) => isUserFacingSensor(entity))
    .map((entity) => ({
      entity,
      sensorMetadata: entityToSensorMetadata(entity),
    }));

  // Filter sensors based on entity filter
  const filteredSensors = sensors.filter((item) => {
    if (entityFilter === 'all') return true;
    if (entityFilter === 'sensor') return true;
    if (entityFilter === 'binary_sensor')
      return item.sensorMetadata.type === 'binary';
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

      {/* Sensor widgets - only show when NOT in control entities view (to avoid duplicates) */}
      {!isControlEntity && isSensorEntity && filteredSensors.length > 0 && (
        <div>
          <div className="mb-4">
            <Text className="text-lg font-semibold">Sensor Data</Text>
            <Text className="text-sm text-muted-foreground">
              {filteredSensors.length} sensor
              {filteredSensors.length !== 1 ? 's' : ''}
            </Text>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSensors.map((item) => (
              <SensorWidget
                deviceId={deviceId}
                entity={item.entity}
                key={item.sensorMetadata.key}
                mode="full"
                sensor={item.sensorMetadata}
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

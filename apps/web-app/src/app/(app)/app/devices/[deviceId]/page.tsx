import { getApi } from '@cove/api/server';
import type { SensorMetadata } from '@cove/types/widget';
import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { H2, Text } from '@cove/ui/custom/typography';
import { Power } from 'lucide-react';
import { Suspense } from 'react';
import { ESPHomeControls } from './_components/esphome-controls';
import { HueLightControls } from './_components/hue-light-controls';
import { SensorWidget } from './_components/sensor-widget';

interface DevicePageProps {
  params: Promise<{ deviceId: string }>;
}

export default async function DevicePage({ params }: DevicePageProps) {
  const { deviceId } = await params;

  return (
    <div className="grid gap-6 p-6">
      <Suspense fallback={<div>Loading device...</div>}>
        <DeviceDetails deviceId={deviceId} />
      </Suspense>
    </div>
  );
}

async function DeviceDetails({ deviceId }: { deviceId: string }) {
  // Fetch device and its entities from tRPC
  const api = await getApi();
  const [device, entities] = await Promise.all([
    api.device.get.fetch({ id: deviceId }),
    api.device.getEntities.fetch({ deviceId }),
  ]);

  if (!device) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-8 items-center justify-center text-center">
          <Text>Device not found</Text>
        </CardContent>
      </Card>
    );
  }

  const isHueLight = device.protocol === 'hue' && device.deviceType === 'light';
  const isESPHomeDevice = device.protocol === 'esphome';

  // Convert entities to sensor metadata for widgets
  const sensors: SensorMetadata[] = entities
    .filter((entity) => {
      // Filter for sensor-like entities
      return (
        entity.kind === 'sensor' ||
        entity.kind === 'binary_sensor' ||
        entity.kind === 'number' ||
        entity.kind === 'button'
      );
    })
    .map((entity) => {
      const currentValue = entity.state?.state;
      const isNumeric = typeof currentValue === 'number';
      const isBoolean = typeof currentValue === 'boolean';

      return {
        currentValue,
        key: entity.entityId,
        lastChanged: entity.state?.updatedAt || new Date(),
        name: entity.name,
        type: isBoolean ? 'binary' : isNumeric ? 'continuous' : 'text',
      };
    });

  // Group entities by type for better organization
  const entityGroups = {
    climate: entities.filter((e) => e.kind === 'climate'),
    controls: entities.filter(
      (e) => e.kind === 'number' || e.kind === 'button',
    ),
    covers: entities.filter((e) => e.kind === 'cover'),
    lights: entities.filter((e) => e.kind === 'light'),
    other: entities.filter(
      (e) =>
        ![
          'light',
          'sensor',
          'binary_sensor',
          'number',
          'button',
          'switch',
          'cover',
          'climate',
        ].includes(e.kind),
    ),
    sensors: entities.filter(
      (e) => e.kind === 'sensor' || e.kind === 'binary_sensor',
    ),
    switches: entities.filter((e) => e.kind === 'switch'),
  };

  return (
    <>
      <div className="grid gap-2">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4">
          <H2>{device.name}</H2>
          <Badge variant={device.online ? 'default' : 'destructive'}>
            {device.online ? 'Online' : 'Offline'}
          </Badge>
        </div>
        <Text variant="muted">
          {device.deviceType} • {device.protocol || 'Unknown protocol'}
          {device.room && ` • ${device.room.name}`}
        </Text>
        {(device.host || device.ipAddress) && (
          <Text className="text-sm" variant="muted">
            Host: {device.host || device.ipAddress}
          </Text>
        )}
        <Text className="text-sm" variant="muted">
          {entities.length} entity{entities.length !== 1 ? 'ies' : ''}{' '}
          discovered
        </Text>
      </div>

      {/* Protocol-specific controls */}
      {isHueLight ? (
        <HueLightControls entities={entityGroups.lights} />
      ) : isESPHomeDevice ? (
        <ESPHomeControls deviceId={deviceId} entities={entities} />
      ) : (
        <GenericDeviceControls entities={entities} />
      )}

      {/* Dynamic Sensor Widgets */}
      {sensors.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sensors.map((sensor) => (
            <SensorWidget
              deviceId={deviceId}
              key={sensor.key}
              sensor={sensor}
            />
          ))}
        </div>
      )}

      {/* Entity Overview */}
      {entities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Entity Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {Object.entries(entityGroups).map(([groupName, groupEntities]) => {
              if (groupEntities.length === 0) return null;

              return (
                <div className="grid gap-2" key={groupName}>
                  <Text className="font-medium capitalize">
                    {groupName.replace('_', ' ')} ({groupEntities.length})
                  </Text>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {groupEntities.map((entity) => (
                      <div
                        className="flex items-center justify-between rounded-md border p-3"
                        key={entity.entityId}
                      >
                        <div className="grid gap-1">
                          <Text className="text-sm font-medium">
                            {entity.name}
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            {entity.kind} • {entity.key}
                          </Text>
                        </div>
                        <div className="text-right">
                          <Text className="text-sm font-mono">
                            {entity.state?.state || 'unknown'}
                          </Text>
                          {entity.state?.attrs &&
                            Object.keys(entity.state.attrs).length > 0 && (
                              <Text className="text-xs text-muted-foreground">
                                +{Object.keys(entity.state.attrs).length} attrs
                              </Text>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Placeholder when no entities are available */}
      {entities.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Entities Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Text className="text-center py-8" variant="muted">
              No entities discovered for this device. The device may be offline
              or not responding to discovery requests.
            </Text>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// Generic device controls for non-ESPHome/Hue devices
function GenericDeviceControls({
  entities,
}: {
  entities: Array<{
    entityId: string;
    kind: string;
    key: string;
    name: string;
    traits: Record<string, unknown>;
    state?: {
      state: string;
      attrs?: Record<string, unknown>;
      updatedAt: Date;
    };
  }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Entity States</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {entities.length > 0 ? (
            entities.slice(0, 10).map((entity) => (
              <div
                className="grid grid-cols-[120px_1fr] gap-2"
                key={entity.entityId}
              >
                <Text className="capitalize" variant="muted">
                  {entity.name}:
                </Text>
                <Text>{String(entity.state?.state || 'unknown')}</Text>
              </div>
            ))
          ) : (
            <Text className="text-center py-4" variant="muted">
              No entity data available
            </Text>
          )}
          {entities.length > 10 && (
            <Text className="text-center text-sm" variant="muted">
              ... and {entities.length - 10} more entities
            </Text>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button className="w-full" variant="outline">
            <Power className="size-4" />
            Refresh Entities
          </Button>
          <Button className="w-full" variant="outline">
            <Icons.Settings size="sm" />
            Configure Device
          </Button>
          <Button className="w-full" variant="outline">
            <Icons.Refresh size="sm" />
            Restart Device
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

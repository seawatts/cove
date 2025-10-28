'use client';

import { Card, CardContent, CardHeader } from '@cove/ui/card';
import { Text } from '@cove/ui/custom/typography';
import { getEntityDisplayName } from '@cove/utils';
import { ClimateControlTile } from './controls/climate-control-tile';
import { LightControlTile } from './controls/light-control-tile';
import { SwitchControlTile } from './controls/switch-control-tile';

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

interface ControlGridProps {
  deviceId: string;
  entities: Entity[];
  showCharts?: boolean;
}

export function ControlGrid({
  deviceId,
  entities,
  showCharts = false,
}: ControlGridProps) {
  if (entities.length === 0) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-8 items-center justify-center text-center">
          <Text variant="muted">No entities found for the selected filter</Text>
        </CardContent>
      </Card>
    );
  }

  // Group entities by type for better organization
  const entityGroups = {
    climate: entities.filter((e) => e.kind === 'climate'),
    covers: entities.filter((e) => e.kind === 'cover'),
    lights: entities.filter((e) => e.kind === 'light'),
    other: entities.filter(
      (e) =>
        ![
          'light',
          'switch',
          'climate',
          'cover',
          'sensor',
          'binary_sensor',
          'button',
        ].includes(e.kind) && !e.key.toLowerCase().includes('calibrate'),
    ),
    switches: entities.filter((e) => e.kind === 'switch'),
  };

  return (
    <div className="space-y-6">
      {/* Lights */}
      {entityGroups.lights.length > 0 && (
        <div>
          <div className="mb-4">
            <Text className="text-lg font-semibold">Lights</Text>
            <Text className="text-sm text-muted-foreground">
              {entityGroups.lights.length} light
              {entityGroups.lights.length !== 1 ? 's' : ''}
            </Text>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entityGroups.lights.map((entity) => (
              <LightControlTile
                deviceId={deviceId}
                entity={entity}
                key={entity.entityId}
                showChart={showCharts}
              />
            ))}
          </div>
        </div>
      )}

      {/* Switches */}
      {entityGroups.switches.length > 0 && (
        <div>
          <div className="mb-4">
            <Text className="text-lg font-semibold">Switches</Text>
            <Text className="text-sm text-muted-foreground">
              {entityGroups.switches.length} switch
              {entityGroups.switches.length !== 1 ? 'es' : ''}
            </Text>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entityGroups.switches.map((entity) => (
              <SwitchControlTile
                deviceId={deviceId}
                entity={entity}
                key={entity.entityId}
                showChart={showCharts}
              />
            ))}
          </div>
        </div>
      )}

      {/* Climate */}
      {entityGroups.climate.length > 0 && (
        <div>
          <div className="mb-4">
            <Text className="text-lg font-semibold">Climate</Text>
            <Text className="text-sm text-muted-foreground">
              {entityGroups.climate.length} climate control
              {entityGroups.climate.length !== 1 ? 's' : ''}
            </Text>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {entityGroups.climate.map((entity) => (
              <ClimateControlTile
                deviceId={deviceId}
                entity={entity}
                key={entity.entityId}
                showChart={showCharts}
              />
            ))}
          </div>
        </div>
      )}

      {/* Covers */}
      {entityGroups.covers.length > 0 && (
        <div>
          <div className="mb-4">
            <Text className="text-lg font-semibold">Covers</Text>
            <Text className="text-sm text-muted-foreground">
              {entityGroups.covers.length} cover
              {entityGroups.covers.length !== 1 ? 's' : ''}
            </Text>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entityGroups.covers.map((entity) => (
              <Card
                className="min-h-[140px] transition-shadow hover:shadow-md"
                key={entity.entityId}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-3 rounded-full bg-primary" />
                      <Text className="text-lg font-semibold">
                        {getEntityDisplayName({
                          deviceClass: entity.deviceClass,
                          key: entity.key,
                          name: entity.name,
                        })}
                      </Text>
                    </div>
                    <Text className="text-sm text-muted-foreground">
                      {entity.currentState?.state || 'unknown'}
                    </Text>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <Text className="text-2xl font-bold">
                      {entity.currentState?.state || 'Unknown'}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      Cover position
                    </Text>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Other entities */}
      {entityGroups.other.length > 0 && (
        <div>
          <div className="mb-4">
            <Text className="text-lg font-semibold">Other</Text>
            <Text className="text-sm text-muted-foreground">
              {entityGroups.other.length} other entit
              {entityGroups.other.length !== 1 ? 'ies' : 'y'}
            </Text>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entityGroups.other.map((entity) => (
              <Card
                className="min-h-[140px] transition-shadow hover:shadow-md"
                key={entity.entityId}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-3 rounded-full bg-muted" />
                      <Text className="text-lg font-semibold">
                        {getEntityDisplayName({
                          deviceClass: entity.deviceClass,
                          key: entity.key,
                          name: entity.name,
                        })}
                      </Text>
                    </div>
                    <Text className="text-xs text-muted-foreground capitalize">
                      {entity.kind}
                    </Text>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <Text className="text-2xl font-bold">
                      {String(entity.currentState?.state || 'unknown')}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      Current state
                    </Text>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { getHubApi } from '@cove/api/hub/react';
import type { EntityWithStateAndCapabilities } from '@cove/db/hub';
import { parseCapabilities } from '@cove/db/hub';
import { Card, CardContent } from '@cove/ui/card';
import { Text } from '@cove/ui/custom/typography';
import { Suspense } from 'react';
import { DeviceDetailsCard } from './_components/device-details-card';
import { DeviceDetailsClient } from './_components/device-details-client';

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
  // Fetch device and its entities from hub tRPC
  const hubApi = getHubApi();
  const [device, entities] = await Promise.all([
    hubApi.device.get.query({ deviceId }),
    hubApi.device.getEntities.query({ deviceId }),
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

  // Transform entities from hub format to web app format with parsed capabilities
  const transformedEntities: EntityWithStateAndCapabilities[] = entities.map(
    (entity) => ({
      ...entity,
      capabilities: parseCapabilities(entity.capability),
      currentState: entity.currentState,
    }),
  );

  // Filter button entities for device details card
  const buttonEntities = transformedEntities.filter(
    (entity) =>
      entity.kind === 'button' ||
      entity.key?.toLowerCase().includes('calibrate'),
  );

  return (
    <>
      {/* Device Details Card */}
      <DeviceDetailsCard
        buttonEntities={buttonEntities}
        device={device}
        entityCount={entities.length}
        room={device.room}
      />

      {/* Client component handles filtering and rendering */}
      {transformedEntities.length > 0 ? (
        <DeviceDetailsClient
          deviceId={deviceId}
          entities={transformedEntities}
        />
      ) : (
        <Card>
          <CardContent className="grid gap-4 p-8 items-center justify-center text-center">
            <Text>No entities found for this device</Text>
            <Text className="text-sm" variant="muted">
              Entities will appear here once the device is connected and
              discovered.
            </Text>
          </CardContent>
        </Card>
      )}
    </>
  );
}

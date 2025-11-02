import { Card, CardContent } from '@cove/ui/card';
import { Text } from '@cove/ui/custom/typography';
import { Suspense } from 'react';
import { getHubApi } from '~/lib/hub-trpc/server';
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

  // Debug: Log what we received
  console.log('[DeviceDetails] Device:', device.id, device.name);
  console.log('[DeviceDetails] Entities count:', entities.length);
  console.log('[DeviceDetails] First entity:', entities[0]);

  // Helper to transform hub entity to component format
  const transformEntity = (entity: (typeof entities)[0]) => {
    // Convert capability object to array if needed
    let capabilities: Array<Record<string, unknown>> = [];
    if (entity.capability) {
      if (Array.isArray(entity.capability)) {
        capabilities = entity.capability as Array<Record<string, unknown>>;
      } else if (typeof entity.capability === 'object') {
        capabilities = [entity.capability as Record<string, unknown>];
      }
    }

    return {
      capabilities,
      currentState: entity.currentState,
      deviceClass: entity.deviceClass ?? null,
      displayName: entity.displayName ?? null,
      entityId: entity.id,
      key: entity.key ?? '',
      name: entity.name ?? null,
    };
  };

  // Filter button entities for device details card
  const buttonEntities = entities.filter(
    (entity) =>
      entity.kind === 'button' ||
      entity.key?.toLowerCase().includes('calibrate'),
  );

  return (
    <>
      {/* Device Details Card */}
      <DeviceDetailsCard
        buttonEntities={buttonEntities.map(transformEntity)}
        device={{
          available: true,
          categories: [],
          configUrl: undefined,
          hostname: undefined,
          hwVersion: undefined,
          ipAddress: device.ip,
          lastSeen: device.lastSeen ?? undefined,
          macAddress: undefined,
          manufacturer: device.vendor ?? undefined,
          matterNodeId: undefined,
          model: device.model ?? undefined,
          name: device.name || 'Unknown Device',
          online: !!device.lastSeen,
          port: undefined,
          protocol: device.protocol || 'unknown',
          room: device.room ?? undefined,
          swVersion: undefined,
          type: undefined,
        }}
        entityCount={entities.length}
      />

      {/* Client component handles filtering and rendering */}
      {entities.length > 0 ? (
        <DeviceDetailsClient
          deviceId={deviceId}
          entities={entities.map(transformEntity)}
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

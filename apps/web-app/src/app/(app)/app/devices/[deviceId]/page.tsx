import { getApi } from '@cove/api/server';
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
  // Fetch device and its entities from tRPC
  const api = await getApi();
  const [device, entities] = await Promise.all([
    api.device.get.fetch({ deviceId }),
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

  // Filter button entities for device details card
  const buttonEntities = entities.filter(
    (entity) =>
      entity.kind === 'button' ||
      entity.key.toLowerCase().includes('calibrate'),
  );

  return (
    <>
      {/* Device Details Card */}
      <DeviceDetailsCard
        buttonEntities={buttonEntities.map((entity) => ({
          ...entity,
          currentState: entity.currentState
            ? {
                ...entity.currentState,
                attrs: entity.currentState.attrs as Record<string, unknown>,
              }
            : null,
          deviceClass: entity.deviceClass ?? null,
          name: entity.name ?? null,
        }))}
        device={{
          available: device.available ?? true,
          categories: device.categories ?? [],
          configUrl: device.configUrl ?? undefined,
          hostname: device.hostname ?? undefined,
          hwVersion: device.hwVersion ?? undefined,
          ipAddress: device.ipAddr ?? undefined,
          lastSeen: device.lastSeen ?? undefined,
          macAddress: device.macAddress ?? undefined,
          manufacturer: device.manufacturer ?? undefined,
          matterNodeId: device.matterNodeId ?? undefined,
          model: device.model ?? undefined,
          name: device.name || 'Unknown Device',
          online: device.online ?? false,
          port: device.port ?? undefined,
          protocol: device.protocol || 'unknown',
          room: device.room ?? undefined,
          swVersion: device.swVersion ?? undefined,
          type: device.type ?? undefined,
        }}
        entityCount={entities.length}
      />

      {/* Client component handles filtering and rendering */}
      <DeviceDetailsClient
        deviceId={deviceId}
        entities={entities.map((entity) => ({
          ...entity,
          capabilities: entity.capabilities as unknown as Array<
            Record<string, unknown>
          >,
          currentState: entity.currentState
            ? {
                ...entity.currentState,
                attrs: entity.currentState.attrs as Record<string, unknown>,
              }
            : null,
          deviceClass: entity.deviceClass ?? null,
          name: entity.name ?? null,
        }))}
      />
    </>
  );
}

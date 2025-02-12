import { Card } from '@acme/ui/card';
import { Icons } from '@acme/ui/icons';
import { H1 } from '@acme/ui/typography';
import { Suspense } from 'react';

interface DashboardPageProps {
  params: {
    dashboardId: string;
  };
}

export default function DashboardPage({ params }: DashboardPageProps) {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <H1>Dashboard</H1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Icons.Plus className="size-4" />
            Add Device
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Icons.Spinner className="size-6 animate-spin text-primary" />
            </div>
          }
        >
          <DeviceGrid dashboardId={params.dashboardId} />
        </Suspense>
      </div>
    </div>
  );
}

async function DeviceGrid({ dashboardId }: { dashboardId: string }) {
  // TODO: Fetch devices from the backend
  const devices = [
    { id: '1', name: 'Living Room Light', type: 'light', status: 'on' },
    {
      id: '2',
      name: 'Kitchen Temperature',
      type: 'temperature',
      status: '23°C',
    },
    { id: '3', name: 'Front Door', type: 'door', status: 'locked' },
  ];

  return (
    <>
      {devices.map((device) => (
        <Card key={device.id} className="p-4">
          <div className="flex items-center gap-4">
            <DeviceIcon type={device.type} />
            <div className="flex-1">
              <h3 className="font-medium">{device.name}</h3>
              <p className="text-sm text-muted-foreground">{device.status}</p>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}

function DeviceIcon({ type }: { type: string }) {
  switch (type) {
    case 'light':
      return <Icons.SunMedium className="size-6 text-primary" />;
    case 'temperature':
      return <Icons.CircleDot className="size-6 text-primary" />;
    case 'door':
      return <Icons.Home className="size-6 text-primary" />;
    default:
      return <Icons.Circle className="size-6 text-primary" />;
  }
}

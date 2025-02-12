import { Suspense } from 'react';

import { HydrationBoundary, api } from '@acme/api/server';
import { Button } from '@acme/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@acme/ui/card';
import { Icons } from '@acme/ui/icons';
import { Skeleton } from '@acme/ui/skeleton';
import { H1, P, Text } from '@acme/ui/typography';
import { DevicesTable } from './devices/_components/devices-table';

type Device = {
  id: string;
  friendly_name: string;
  status: string;
  protocol: string;
  categories: string[];
  location: { room: string; floor: string; zone: string };
  last_online: string;
  metadata: { icon_url: string };
};

function DevicesTableSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from([
        'skeleton-1',
        'skeleton-2',
        'skeleton-3',
        'skeleton-4',
        'skeleton-5',
        'skeleton-6',
      ]).map((key) => (
        <div
          key={key}
          className="bg-card flex flex-col gap-4 rounded-xl border p-6 shadow-2xs"
        >
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

function DeviceStats({ devices }: { devices: Device[] }) {
  const onlineDevices =
    devices?.filter((d) => d.status === 'Online').length ?? 0;
  const offlineDevices =
    devices?.filter((d) => d.status === 'Offline').length ?? 0;
  const totalDevices = devices?.length ?? 0;

  const stats = [
    {
      name: 'Total Devices',
      value: totalDevices,
      icon: <Icons.CircleDot className="size-4" />,
    },
    {
      name: 'Online',
      value: onlineDevices,
      icon: <Icons.CheckCircle2 className="size-4 text-primary" />,
    },
    {
      name: 'Offline',
      value: offlineDevices,
      icon: <Icons.AlertCircle className="size-4 text-destructive" />,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.name}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
            {stat.icon}
          </CardHeader>
          <CardContent>
            <Text className="text-2xl font-bold">{stat.value}</Text>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Button variant="outline" className="justify-start">
          <Icons.Plus className="size-4 mr-2" />
          Add Device
        </Button>
        <Button variant="outline" className="justify-start">
          <Icons.ListFilter className="size-4 mr-2" />
          Filter Devices
        </Button>
        <Button variant="outline" className="justify-start">
          <Icons.SlidersHorizontal className="size-4 mr-2" />
          Configure
        </Button>
        <Button variant="outline" className="justify-start">
          <Icons.Settings className="size-4 mr-2" />
          Settings
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function Page() {
  await api.prefetch(['devices']);

  return (
    <main className="container py-16">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <H1>Cove</H1>
          <P className="text-muted-foreground">
            Your smart home automation platform
          </P>
        </div>

        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from(['1', '2', '3']).map((key) => (
                <Card key={key}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="size-4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-12" />
                  </CardContent>
                </Card>
              ))}
            </div>
          }
        >
          <HydrationBoundary>
            <DeviceStats devices={await api.fetch(['devices'])} />
          </HydrationBoundary>
        </Suspense>

        <QuickActions />

        <Card>
          <CardHeader>
            <CardTitle>Connected Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<DevicesTableSkeleton />}>
              <HydrationBoundary>
                <DevicesTable />
              </HydrationBoundary>
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

import { api } from '@acme/api/client';
import { Button } from '@acme/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@acme/ui/card';
import { Icons } from '@acme/ui/icons';
import { H1, P, Text } from '@acme/ui/typography';
import { createFileRoute } from '@tanstack/react-router';
import { Suspense } from 'react';

import { DevicesTable } from '../components/devices/devices-table';

function Home() {
  const devices1 = api.useQuery(['devices']);
  const { data: devices } = devices1;

  return (
    <main className="container px-4 py-8 md:py-16">
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col items-center justify-center gap-3 md:gap-4 text-center">
          <H1 className="text-3xl md:text-4xl">Cove</H1>
          <P className="text-muted-foreground text-lg">
            Your smart home automation platform
          </P>
        </div>

        <Suspense
          fallback={
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              {Array.from(['1', '2', '3']).map((key) => (
                <Card key={key} className="p-6">
                  <CardHeader className="flex flex-row items-center justify-between p-0 pb-4">
                    <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                    <div className="size-5 animate-pulse rounded bg-muted" />
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-10 w-16 animate-pulse rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          }
        >
          {devices && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <Card className="p-6">
                <CardHeader className="flex flex-row items-center justify-between p-0 pb-4">
                  <CardTitle className="text-base md:text-lg font-medium">
                    Total Devices
                  </CardTitle>
                  <Icons.CircleDot className="size-5 md:size-4" />
                </CardHeader>
                <CardContent className="p-0">
                  <Text className="text-3xl md:text-2xl font-bold">
                    {devices.length}
                  </Text>
                </CardContent>
              </Card>

              <Card className="p-6">
                <CardHeader className="flex flex-row items-center justify-between p-0 pb-4">
                  <CardTitle className="text-base md:text-lg font-medium">
                    Online
                  </CardTitle>
                  <Icons.CheckCircle2 className="size-5 md:size-4 text-primary" />
                </CardHeader>
                <CardContent className="p-0">
                  <Text className="text-3xl md:text-2xl font-bold">
                    {devices.filter((d) => d.status === 'Online').length}
                  </Text>
                </CardContent>
              </Card>

              <Card className="p-6">
                <CardHeader className="flex flex-row items-center justify-between p-0 pb-4">
                  <CardTitle className="text-base md:text-lg font-medium">
                    Offline
                  </CardTitle>
                  <Icons.AlertCircle className="size-5 md:size-4 text-destructive" />
                </CardHeader>
                <CardContent className="p-0">
                  <Text className="text-3xl md:text-2xl font-bold">
                    {devices.filter((d) => d.status === 'Offline').length}
                  </Text>
                </CardContent>
              </Card>
            </div>
          )}
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start h-12 md:h-10">
              <Icons.Plus className="size-5 mr-3 md:size-4 md:mr-2" />
              Add Device
            </Button>
            <Button variant="outline" className="justify-start h-12 md:h-10">
              <Icons.ListFilter className="size-5 mr-3 md:size-4 md:mr-2" />
              Filter Devices
            </Button>
            <Button variant="outline" className="justify-start h-12 md:h-10">
              <Icons.SlidersHorizontal className="size-5 mr-3 md:size-4 md:mr-2" />
              Configure
            </Button>
            <Button variant="outline" className="justify-start h-12 md:h-10">
              <Icons.Settings className="size-5 mr-3 md:size-4 md:mr-2" />
              Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">
              Connected Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={<div className="text-lg">Loading devices...</div>}
            >
              <DevicesTable />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export const Route = createFileRoute('/')({
  component: Home,
});

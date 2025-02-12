import { api } from '@acme/api/client';
import { Button } from '@acme/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@acme/ui/card';
import { Icons } from '@acme/ui/icons';
import { H1, P } from '@acme/ui/typography';
import { createFileRoute } from '@tanstack/react-router';
import { Suspense } from 'react';

import { DevicesTable } from '~/components/devices/devices-table';

function DevicesPage() {
  const { data: devices } = api.useQuery(['devices']);

  return (
    <div className="container px-4 py-8 md:py-16">
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col items-center justify-center gap-3 md:gap-4 text-center">
          <H1 className="text-3xl md:text-4xl">Devices</H1>
          <P className="text-muted-foreground text-lg">
            Manage and monitor your connected devices
          </P>
        </div>

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
    </div>
  );
}

export const Route = createFileRoute('/devices/')({
  component: DevicesPage,
});

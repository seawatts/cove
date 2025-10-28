'use client';

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@cove/ui/card';

export function SectionCards() {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4  *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card col-span-2 row-span-2">
        <CardHeader>
          <CardDescription>Welcome to Cove</CardDescription>
          <CardTitle className="flex items-center gap-2 w-full">
            <span className="text-lg">Your Home Automation Dashboard</span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex flex-col gap-1 w-full">
            <div className="text-muted-foreground">
              Manage your devices, rooms, and automations from this central
              dashboard.
            </div>
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card col-span-2 row-span-2">
        <CardHeader>
          <CardDescription>Quick Actions</CardDescription>
          <CardTitle className="flex items-center gap-2 w-full">
            <span className="text-lg">Get Started</span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="flex flex-col gap-1 w-full">
            <div className="text-muted-foreground">
              Add devices, create rooms, and set up automations to get the most
              out of Cove.
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import Link from 'next/link';

export function RoomsList() {
  // TODO: Fetch real rooms from Supabase
  const rooms: Array<{
    id: string;
    name: string;
    deviceCount: number;
    icon?: string;
  }> = [];

  if (rooms.length === 0) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-8 items-center justify-center text-center">
          <Icons.Home size="2xl" variant="muted" />
          <div className="grid gap-2">
            <Text>No rooms yet</Text>
            <Text variant="muted">Create rooms to organize your devices</Text>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rooms.map((room) => {
        const IconComponent =
          Icons[(room.icon as keyof typeof Icons) || 'Home'] || Icons.Home;
        return (
          <Link href={`/app/rooms/${room.id}`} key={room.id}>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <span>{room.name}</span>
                  <IconComponent size="sm" variant="muted" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Text variant="muted">
                  {room.deviceCount} device{room.deviceCount !== 1 ? 's' : ''}
                </Text>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

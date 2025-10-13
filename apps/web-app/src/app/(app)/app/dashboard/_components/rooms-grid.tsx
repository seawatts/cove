'use client';

import { Badge } from '@cove/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Text } from '@cove/ui/custom/typography';
import Link from 'next/link';

export function RoomsGrid() {
  // TODO: Fetch real rooms from Supabase
  const rooms = [
    { deviceCount: 0, icon: 'Home', id: 1, name: 'Living Room' },
    { deviceCount: 0, icon: 'BedDouble', id: 2, name: 'Bedroom' },
    { deviceCount: 0, icon: 'ChefHat', id: 3, name: 'Kitchen' },
    { deviceCount: 0, icon: 'Laptop', id: 4, name: 'Office' },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[1fr_auto] items-center">
        <h3 className="text-xl font-semibold">Rooms</h3>
        <Link href="/app/rooms/new">
          <Badge variant="outline">
            <Icons.Plus size="sm" />
            Add Room
          </Badge>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {rooms.map((room) => {
          const IconComponent =
            Icons[room.icon as keyof typeof Icons] || Icons.Home;
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
    </div>
  );
}

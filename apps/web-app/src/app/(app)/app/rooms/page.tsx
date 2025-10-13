import { Button } from '@cove/ui/button';
import { Icons } from '@cove/ui/custom/icons';
import { H2, Text } from '@cove/ui/custom/typography';
import Link from 'next/link';
import { Suspense } from 'react';
import { RoomsList } from './_components/rooms-list';

export default function RoomsPage() {
  return (
    <div className="grid gap-6 p-6">
      <div className="grid grid-cols-[1fr_auto] items-center gap-4">
        <div className="grid gap-2">
          <H2>Rooms</H2>
          <Text variant="muted">Organize your devices by room</Text>
        </div>
        <Link href="/app/rooms/new">
          <Button>
            <Icons.Plus size="sm" />
            Add Room
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div>Loading rooms...</div>}>
        <RoomsList />
      </Suspense>
    </div>
  );
}

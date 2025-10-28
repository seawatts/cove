'use client';

import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cove/ui/card';
import { Icons } from '@cove/ui/custom/icons';
import { Lightbulb } from 'lucide-react';

export function QuickActions() {
  // TODO: Implement actual quick actions
  const actions = [
    { icon: 'Sunrise', id: 1, name: 'Good Morning' },
    { icon: 'Moon', id: 2, name: 'Good Night' },
    { icon: 'Tv', id: 3, name: 'Movie Time' },
    { icon: 'Lock', id: 4, name: 'Away' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action) => {
          const IconComponent =
            Icons[action.icon as keyof typeof Icons] || Lightbulb;
          return (
            <Button
              className="grid gap-2 h-auto p-4"
              key={action.id}
              variant="outline"
            >
              <IconComponent className="size-6" />
              <span className="text-sm">{action.name}</span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}

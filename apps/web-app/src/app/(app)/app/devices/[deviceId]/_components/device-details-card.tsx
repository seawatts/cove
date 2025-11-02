'use client';

import type {
  Device,
  EntityWithStateAndCapabilities,
  Room,
} from '@cove/db/hub';
import { Badge } from '@cove/ui/badge';
import { Button } from '@cove/ui/button';
import { Card, CardContent, CardHeader } from '@cove/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@cove/ui/collapsible';
import { Icons } from '@cove/ui/custom/icons';
import { H2, Text } from '@cove/ui/custom/typography';
import { getEntityDisplayName } from '@cove/utils';
import { ChevronDown } from 'lucide-react';
import * as React from 'react';

interface DeviceDetailsCardProps {
  device: Device;
  room?: Room | null;
  entityCount: number;
  buttonEntities?: EntityWithStateAndCapabilities[];
}

export function DeviceDetailsCard({
  device,
  room,
  entityCount,
  buttonEntities = [],
}: DeviceDetailsCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleButtonClick = (entityId: string) => {
    // TODO: Implement button action
    console.log('Button clicked:', entityId);
  };

  const isOnline = !!device.lastSeen;

  const getStatusBadge = () => {
    if (isOnline) {
      return <Badge variant="default">Online</Badge>;
    }
    return <Badge variant="secondary">Offline</Badge>;
  };

  const formatLastSeen = (lastSeen?: Date) => {
    if (!lastSeen) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const technicalDetails = [
    { label: 'IP Address', value: device.ip },
    { label: 'Fingerprint', value: device.fingerprint },
    { label: 'Vendor', value: device.vendor },
    { label: 'Model', value: device.model },
    { label: 'Bridge ID', value: device.bridgeId },
    { label: 'Last Seen', value: formatLastSeen(device.lastSeen ?? undefined) },
    {
      label: 'Paired At',
      value: device.pairedAt
        ? new Date(device.pairedAt).toLocaleString()
        : null,
    },
  ].filter((detail) => detail.value);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <H2 className="text-xl">{device.name}</H2>
            {getStatusBadge()}
          </div>
          <Collapsible onOpenChange={setIsOpen} open={isOpen}>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="ghost">
                <Icons.Settings size="sm" />
                <ChevronDown
                  className={`ml-1 size-4 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        <div className="space-y-1">
          <Text variant="muted">
            {device.protocol}
            {room && ` • ${room.name}`}
          </Text>
          <Text className="text-sm" variant="muted">
            {entityCount} entity{entityCount !== 1 ? 'ies' : ''} discovered
          </Text>
        </div>

        {/* Device Controls - Always visible */}
        {buttonEntities.length > 0 && (
          <div className="space-y-2 mt-4">
            <Text className="text-sm font-medium">Device Controls</Text>
            <div className="flex flex-wrap gap-2">
              {buttonEntities.map((entity) => (
                <Button
                  key={entity.id}
                  onClick={() => handleButtonClick(entity.id)}
                  variant="outline"
                >
                  {getEntityDisplayName({
                    deviceClass: entity.deviceClass,
                    displayName: entity.displayName,
                    key: entity.key || '',
                    name: entity.name || '',
                  })}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardHeader>

      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div>
                <Text className="text-sm font-medium mb-2">
                  Technical Details
                </Text>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {technicalDetails.map((detail) => (
                    <div className="space-y-1" key={detail.label}>
                      <Text className="text-xs text-muted-foreground">
                        {detail.label}
                      </Text>
                      <Text className="text-sm font-mono">{detail.value}</Text>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

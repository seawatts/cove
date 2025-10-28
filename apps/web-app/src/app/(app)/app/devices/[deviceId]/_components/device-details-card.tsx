'use client';

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

interface Entity {
  entityId: string;
  kind: string;
  key: string;
  deviceClass?: string | null;
  name?: string | null;
  currentState?: {
    state: string;
    attrs?: Record<string, unknown>;
    updatedAt: Date;
  } | null;
}

interface DeviceDetailsCardProps {
  device: {
    name: string;
    online: boolean;
    available: boolean;
    protocol: string;
    type?: string;
    manufacturer?: string;
    model?: string;
    ipAddress?: string;
    macAddress?: string;
    hwVersion?: string;
    swVersion?: string;
    configUrl?: string;
    hostname?: string;
    port?: number;
    categories?: string[];
    lastSeen?: Date;
    matterNodeId?: number;
    room?: {
      name: string;
      roomId: string;
    };
  };
  entityCount: number;
  buttonEntities?: Entity[];
}

export function DeviceDetailsCard({
  device,
  entityCount,
  buttonEntities = [],
}: DeviceDetailsCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleButtonClick = (entityId: string) => {
    // TODO: Implement button action
    console.log('Button clicked:', entityId);
  };

  const getStatusBadge = () => {
    if (!device.available) {
      return <Badge variant="destructive">Unavailable</Badge>;
    }
    if (device.online) {
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
    { label: 'IP Address', value: device.ipAddress },
    { label: 'MAC Address', value: device.macAddress },
    { label: 'Manufacturer', value: device.manufacturer },
    { label: 'Model', value: device.model },
    { label: 'Hardware Version', value: device.hwVersion },
    { label: 'Software Version', value: device.swVersion },
    { label: 'Hostname', value: device.hostname },
    { label: 'Port', value: device.port?.toString() },
    { label: 'Matter Node ID', value: device.matterNodeId?.toString() },
    { label: 'Last Seen', value: formatLastSeen(device.lastSeen) },
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
            {device.type && `${device.type} • `}
            {device.protocol}
            {device.room && ` • ${device.room.name}`}
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
                  key={entity.entityId}
                  onClick={() => handleButtonClick(entity.entityId)}
                  variant="outline"
                >
                  {getEntityDisplayName({
                    deviceClass: entity.deviceClass,
                    key: entity.key,
                    name: entity.name,
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
              {device.categories && device.categories.length > 0 && (
                <div>
                  <Text className="text-sm font-medium mb-2">Categories</Text>
                  <div className="flex flex-wrap gap-1">
                    {device.categories.map((category) => (
                      <Badge
                        className="text-xs"
                        key={category}
                        variant="outline"
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Device Actions */}
              {device.configUrl && (
                <div className="space-y-2">
                  <Text className="text-sm font-medium">Device Actions</Text>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={device.configUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <Icons.ExternalLink className="mr-2" size="sm" />
                      Open Config Interface
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

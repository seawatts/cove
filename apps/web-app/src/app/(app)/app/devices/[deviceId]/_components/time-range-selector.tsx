'use client';

import { useIsMobile } from '@cove/ui/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cove/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@cove/ui/toggle-group';
import { useQueryState } from 'nuqs';
import * as React from 'react';

type TimeRange = '1h' | '24h' | '7d' | '30d' | '90d';

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

export function TimeRangeSelector() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = useQueryState('timeRange', {
    defaultValue: '24h',
    parse: (value) => (value as TimeRange) || '24h',
    serialize: (value) => value,
  });

  React.useEffect(() => {
    if (isMobile && timeRange === '90d') {
      setTimeRange('30d');
    }
  }, [isMobile, timeRange, setTimeRange]);

  const availableOptions = isMobile
    ? timeRangeOptions.filter((option) => option.value !== '90d')
    : timeRangeOptions;

  if (isMobile) {
    return (
      <Select
        onValueChange={(value: string) => setTimeRange(value as TimeRange)}
        value={timeRange}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Select time range" />
        </SelectTrigger>
        <SelectContent>
          {availableOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <ToggleGroup
      className="hidden md:flex"
      onValueChange={(value: string) => {
        if (value) setTimeRange(value as TimeRange);
      }}
      type="single"
      value={timeRange}
      variant="outline"
    >
      {availableOptions.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

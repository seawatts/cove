import type { TimeRange } from '@cove/db/graph-queries';
import { createParser, parseAsInteger } from 'nuqs';

// Re-export TimeRange for convenience
export type { TimeRange };

// TimeRange values for validation
export const timeRangeValues: readonly TimeRange[] = [
  '1h',
  '24h',
  '7d',
  '30d',
  '90d',
] as const;

// Create a type-safe parser for TimeRange
// This ensures URL query params are properly typed and match the backend API types
export const timeRangeParser = createParser({
  parse: (value: string): TimeRange => {
    if (timeRangeValues.includes(value as TimeRange)) {
      return value as TimeRange;
    }
    return '24h'; // default value
  },
  serialize: (value: TimeRange) => value,
}).withDefault('24h' as TimeRange);

// Zoom range parsers for custom time ranges
// These allow users to zoom into specific time windows that persist across page refreshes
export const zoomStartParser = parseAsInteger;
export const zoomEndParser = parseAsInteger;

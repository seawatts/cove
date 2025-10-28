/**
 * Fill gaps in time series data with synthetic points showing values remained constant
 * This makes charts show continuous lines even when no state changes were recorded
 */

interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  [key: string]: unknown;
}

interface FillGapsOptions {
  /**
   * Maximum gap duration in milliseconds before filling
   * Default: 5 minutes (300000ms)
   */
  maxGapMs?: number;
  /**
   * Interval for synthetic points in milliseconds
   * Default: 1 minute (60000ms)
   */
  fillIntervalMs?: number;
  /**
   * Time range to fill to (defaults to now)
   */
  fillToTimestamp?: number;
  /**
   * Time range to fill from (defaults to first data point)
   */
  fillFromTimestamp?: number;
  /**
   * Default value for synthetic points when no previous data exists
   * Default: 0
   */
  defaultValue?: number;
}

/**
 * Fill gaps in time series data with forward-filled values
 *
 * @example
 * const data = [
 *   { timestamp: 1000, value: 10 },
 *   { timestamp: 10000, value: 10 }, // 9 second gap
 * ];
 * const filled = fillTimeSeriesGaps(data, { fillIntervalMs: 3000 });
 * // Returns: [
 * //   { timestamp: 1000, value: 10 },
 * //   { timestamp: 4000, value: 10, synthetic: true },
 * //   { timestamp: 7000, value: 10, synthetic: true },
 * //   { timestamp: 10000, value: 10 }
 * // ]
 */
export function fillTimeSeriesGaps<T extends TimeSeriesPoint>(
  data: T[],
  options: FillGapsOptions = {},
): (T | (T & { synthetic: true }))[] {
  const {
    maxGapMs = 5 * 60 * 1000, // 5 minutes
    fillIntervalMs = 60 * 1000, // 1 minute
    fillToTimestamp = Date.now(),
    fillFromTimestamp,
    defaultValue = 0,
  } = options;

  if (data.length === 0) {
    return [];
  }

  // Sort by timestamp ascending
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const result: (T | (T & { synthetic: true }))[] = [];

  // Fill gaps at the beginning of the time range if fillFromTimestamp is provided
  if (fillFromTimestamp && sorted.length > 0) {
    const firstDataPoint = sorted[0];
    if (firstDataPoint) {
      const gapToFirstPoint = firstDataPoint.timestamp - fillFromTimestamp;

      if (gapToFirstPoint > fillIntervalMs) {
        // Generate synthetic points from fillFromTimestamp to first data point
        let syntheticTime = fillFromTimestamp;

        while (syntheticTime < firstDataPoint.timestamp) {
          const syntheticPoint = {
            ...firstDataPoint,
            synthetic: true as const,
            timestamp: syntheticTime,
            value: defaultValue,
          } as T & { synthetic: true };

          result.push(syntheticPoint);
          syntheticTime += fillIntervalMs;
        }
      }
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (!current) continue;

    // Add the actual data point
    result.push(current);

    // Calculate gap to next point (or to fillToTimestamp if last point)
    const gapStart = current.timestamp;
    const gapEnd = next ? next.timestamp : fillToTimestamp;
    const gapDuration = gapEnd - gapStart;

    // For the last point, always fill to now (show current state)
    // For intermediate points, only fill if gap exceeds threshold
    const shouldFill = !next || gapDuration > maxGapMs;

    if (shouldFill && gapDuration > fillIntervalMs) {
      // Generate synthetic points at fillIntervalMs intervals
      let syntheticTime = gapStart + fillIntervalMs;

      while (syntheticTime < gapEnd) {
        // Create synthetic point with same value as previous
        const syntheticPoint = {
          ...current,
          synthetic: true as const,
          timestamp: syntheticTime,
        };

        result.push(syntheticPoint);
        syntheticTime += fillIntervalMs;
      }
    }
  }

  return result;
}

/**
 * Get appropriate fill interval based on time range
 */
export function getDefaultFillInterval(timeRangeMs: number): number {
  if (timeRangeMs <= 24 * 60 * 60 * 1000) {
    // 24 hours or less: 5 minute intervals
    return 5 * 60 * 1000;
  }
  if (timeRangeMs <= 7 * 24 * 60 * 60 * 1000) {
    // 7 days: 30 minute intervals
    return 30 * 60 * 1000;
  }
  // 30 days: 2 hour intervals
  return 2 * 60 * 60 * 1000;
}

/**
 * Get time range in milliseconds from string
 */
export function getTimeRangeMs(
  timeRange: '1h' | '24h' | '7d' | '30d' | '90d',
): number {
  const ranges = {
    '1h': 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
  };
  return ranges[timeRange];
}

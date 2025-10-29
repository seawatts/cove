/**
 * Custom hook for fetching entity data using hub-v2 tRPC API
 * Polls every minute for updated data
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hubApi } from '~/lib/hub-trpc';

interface EntityState {
  state: string | number | boolean | Record<string, unknown>;
  updatedAt: Date;
}

interface UseEntityDataProps {
  entityId: string;
  timeRange?: '1h' | '24h' | '7d' | '30d' | '90d';
  onStateChange?: (newState: EntityState) => void;
}

interface AggregatedDataPoint {
  timestamp: number;
  mean: number | null;
  min: number | null;
  max: number | null;
}

interface UseEntityDataReturn {
  // Data
  latestState: EntityState | null;
  latestTelemetryValue: number | string | boolean | null;
  stateHistory: EntityState[];
  aggregatedData: AggregatedDataPoint[];

  // Status
  isLoading: boolean;
  status: 'polling' | 'error';

  // Controls
  refetch: () => void;
}

export function useEntityData({
  entityId,
  timeRange = '24h',
  onStateChange,
}: UseEntityDataProps): UseEntityDataReturn {
  const [latestState, setLatestState] = useState<EntityState | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  const prevEntityStateRef = useRef<string | null>(null);

  // Update ref when callback changes to avoid stale closures
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  // Get current entity state from hub-v2
  const {
    data: entity,
    isLoading: isLoadingEntity,
    refetch: refetchEntity,
    error: entityError,
  } = hubApi.entity.get.useQuery(
    { entityId },
    {
      refetchInterval: 60000, // 1 minute
    },
  );

  // Get aggregated telemetry data from hub-v2
  const {
    data: aggregatedData = [],
    isLoading: isLoadingAggregated,
    refetch: refetchAggregated,
    error: aggregatedError,
  } = hubApi.telemetry.getAggregated.useQuery(
    {
      entityId,
      timeRange,
    },
    {
      refetchInterval: 60000, // 1 minute
    },
  );

  // Get raw telemetry history for state history
  const {
    data: telemetryData = [],
    isLoading: isLoadingTelemetry,
    refetch: refetchTelemetry,
    error: telemetryError,
  } = hubApi.telemetry.get.useQuery(
    {
      entityId,
      limit: 100,
    },
    {
      refetchInterval: 60000, // 1 minute
    },
  );

  // Refetch function
  const refetch = useCallback(() => {
    refetchEntity();
    refetchAggregated();
    refetchTelemetry();
  }, [refetchEntity, refetchAggregated, refetchTelemetry]);

  // Update latest state when entity data arrives
  useEffect(() => {
    if (entity && 'state' in entity && entity.state) {
      // Entity state has: entityId, state (blob), updatedAt
      const stateData = entity.state as {
        state: unknown;
        updatedAt: Date;
      };

      // Create a unique key to compare states and avoid unnecessary updates
      const stateKey = `${JSON.stringify(stateData.state)}_${stateData.updatedAt.getTime()}`;

      // Only update if state actually changed
      if (prevEntityStateRef.current === stateKey) {
        return;
      }

      prevEntityStateRef.current = stateKey;

      const stateValue = stateData.state;
      // Ensure state value matches our expected types
      const validState: string | number | boolean | Record<string, unknown> =
        typeof stateValue === 'string' ||
        typeof stateValue === 'number' ||
        typeof stateValue === 'boolean' ||
        (typeof stateValue === 'object' && stateValue !== null)
          ? (stateValue as Record<string, unknown>)
          : String(stateValue ?? '');
      const entityState: EntityState = {
        state: validState,
        updatedAt: stateData.updatedAt,
      };
      setLatestState(entityState);
      onStateChangeRef.current?.(entityState);
    } else if (
      entity &&
      (!('state' in entity) || !entity.state) &&
      prevEntityStateRef.current !== null
    ) {
      // Reset if entity has no state
      prevEntityStateRef.current = null;
      setLatestState(null);
    }
  }, [entity]);

  // Convert telemetry data to state history format
  // Telemetry records have: entityId, field, homeId, ts, unit, value
  // Use useMemo to prevent recreating array on every render
  const stateHistory = useMemo<EntityState[]>(
    () =>
      telemetryData.map(
        (t: {
          value: number | string | boolean | null;
          ts: Date;
          field: string;
        }) => ({
          state: t.value ?? 0,
          updatedAt: t.ts,
        }),
      ),
    [telemetryData],
  );

  // Get the latest telemetry value (first item in desc sorted array)
  const latestTelemetryValue = useMemo(() => {
    if (telemetryData.length > 0 && telemetryData[0]) {
      // Data is sorted desc by timestamp, so first item is most recent
      const latest = telemetryData[0];
      return latest.value;
    }
    return null;
  }, [telemetryData]);

  // Determine overall status
  const getStatus = (): UseEntityDataReturn['status'] => {
    if (entityError || aggregatedError || telemetryError) {
      return 'error';
    }
    return 'polling';
  };

  const isLoading =
    isLoadingEntity || isLoadingAggregated || isLoadingTelemetry;

  return {
    aggregatedData,
    isLoading,
    latestState,
    latestTelemetryValue,
    refetch,
    stateHistory,
    status: getStatus(),
  };
}

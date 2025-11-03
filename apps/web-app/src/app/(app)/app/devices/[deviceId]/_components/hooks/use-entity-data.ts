/**
 * Custom hook for fetching entity data using hub tRPC API
 * Polls every minute for updated data
 */

import { hubApi } from '@cove/api/hub/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimeRange } from '../../_lib/query-parsers';

interface EntityState {
  state: string | number | boolean | Record<string, unknown>;
  updatedAt: Date;
  unit?: string;
}

interface UseEntityDataProps {
  entityId: string;
  timeRange?: TimeRange;
  onStateChange?: (newState: EntityState) => void;
  enabled?: boolean; // Control whether queries should run
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
  enabled = true, // Default to true for backward compatibility
}: UseEntityDataProps): UseEntityDataReturn {
  const [latestState, setLatestState] = useState<EntityState | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  const prevEntityStateRef = useRef<string | null>(null);

  // Update ref when callback changes to avoid stale closures
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  // Get current entity state from hub
  const {
    data: entity,
    isLoading: isLoadingEntity,
    refetch: refetchEntity,
    error: entityError,
  } = hubApi.entity.get.useQuery(
    { entityId },
    {
      enabled, // Only run query when enabled
      refetchInterval: enabled ? 60000 : false, // 1 minute when enabled, disabled otherwise
    },
  );

  // Get aggregated telemetry data from hub
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
      enabled, // Only run query when enabled
      refetchInterval: enabled ? 60000 : false, // 1 minute when enabled, disabled otherwise
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
      enabled, // Only run query when enabled
      refetchInterval: enabled ? 60000 : false, // 1 minute when enabled, disabled otherwise
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
          unit?: string | null;
        }) => ({
          state: t.value ?? 0,
          unit: t.unit ?? undefined,
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

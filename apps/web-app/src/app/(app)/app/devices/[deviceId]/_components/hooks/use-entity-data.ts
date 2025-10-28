/**
 * Custom hook for fetching entity data using polling only
 * Polls every minute for updated data
 */

import { api } from '@cove/api/react';
import type { EntityStateHistory } from '@cove/db/types';
import { useCallback, useEffect, useState } from 'react';

// Type for API response (without homeId)
type EntityStateHistoryResponse = Omit<EntityStateHistory, 'homeId'>;

interface UseEntityDataProps {
  entityId: string;
  timeRange?: '1h' | '24h' | '7d' | '30d' | '90d';
  onStateChange?: (newState: EntityStateHistoryResponse) => void;
}

interface UseEntityDataReturn {
  // Data
  latestState: EntityStateHistoryResponse | null;
  stateHistory: EntityStateHistoryResponse[];
  aggregatedData: unknown[];

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
  const [latestState, setLatestState] =
    useState<EntityStateHistoryResponse | null>(null);

  // API queries for polling mode - poll every minute (60000ms)
  const {
    data: stateHistory = [],
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
    error: historyError,
  } = api.entity.getStateHistory.useQuery(
    {
      entityId,
      limit: 100,
      timeRange,
    },
    {
      refetchInterval: 60000, // 1 minute
    },
  );

  const {
    data: aggregatedData = [],
    isLoading: isLoadingAggregated,
    refetch: refetchAggregated,
    error: aggregatedError,
  } = api.graph.getEntityAggregatedData.useQuery(
    {
      entityId,
      timeRange,
    },
    {
      refetchInterval: 60000, // 1 minute
    },
  );

  // Refetch function
  const refetch = useCallback(() => {
    refetchHistory();
    refetchAggregated();
  }, [refetchHistory, refetchAggregated]);

  // Update latest state when new data arrives
  useEffect(() => {
    if (stateHistory.length > 0) {
      // Get the most recent state from polling data
      const mostRecent = stateHistory.at(-1);
      if (mostRecent) {
        setLatestState(mostRecent);
        onStateChange?.(mostRecent);
      }
    }
  }, [stateHistory, onStateChange]);

  // Determine overall status
  const getStatus = (): UseEntityDataReturn['status'] => {
    if (historyError || aggregatedError) {
      return 'error';
    }
    return 'polling';
  };

  const isLoading = isLoadingHistory || isLoadingAggregated;

  return {
    aggregatedData,
    isLoading,
    latestState,
    refetch,
    stateHistory,
    status: getStatus(),
  };
}

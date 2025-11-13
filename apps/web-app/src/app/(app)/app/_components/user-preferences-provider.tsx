'use client';

import { api } from '@cove/api/react';
import type { UserPreferences } from '@cove/db/types';
import * as React from 'react';

interface UserPreferencesContextValue {
  preferences: UserPreferences;
  isLoading: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
}

const UserPreferencesContext = React.createContext<
  UserPreferencesContextValue | undefined
>(undefined);

export function UserPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const utils = api.useUtils();

  // Fetch user preferences
  const { data: preferences, isLoading } = api.user.getPreferences.useQuery(
    undefined,
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  );

  // Mutation to update preferences
  const updateMutation = api.user.updatePreferences.useMutation({
    onSuccess: () => {
      // Invalidate the preferences query to refetch
      void utils.user.getPreferences.invalidate();
    },
  });

  const updatePreferences = React.useCallback(
    async (updates: Partial<UserPreferences>) => {
      await updateMutation.mutateAsync(updates);
    },
    [updateMutation],
  );

  const value = React.useMemo(
    () => ({
      isLoading,
      preferences: preferences ?? { syncTooltips: true },
      updatePreferences,
    }),
    [preferences, isLoading, updatePreferences],
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = React.useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error(
      'useUserPreferences must be used within a UserPreferencesProvider',
    );
  }
  return context;
}

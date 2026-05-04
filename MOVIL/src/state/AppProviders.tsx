import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { SettingsProvider } from './SettingsContext';
import { HydrationRemindersProvider } from './HydrationRemindersContext';
import { RouteTrackingProvider } from './RouteTrackingContext';
import { setApiAuthToken } from '../services/api';

function ApiAuthSync() {
  const { status, user } = useAuth();

  useEffect(() => {
    setApiAuthToken(status === 'signedIn' ? user?.token ?? null : null);
  }, [status, user?.token]);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <AuthProvider>
        <ApiAuthSync />
        <HydrationRemindersProvider>
          <RouteTrackingProvider>{children}</RouteTrackingProvider>
        </HydrationRemindersProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}


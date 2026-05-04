import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { SettingsProvider } from './SettingsContext';
import { HydrationRemindersProvider } from './HydrationRemindersContext';
import { setApiAuthToken, setOnUnauthorizedCallback } from '../services/api';

function ApiAuthSync() {
  const { logout, status, user } = useAuth();
  useEffect(() => {
    setOnUnauthorizedCallback(() => logout());
    return () => setOnUnauthorizedCallback(null);
  }, [logout]);

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
        <HydrationRemindersProvider>{children}</HydrationRemindersProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}


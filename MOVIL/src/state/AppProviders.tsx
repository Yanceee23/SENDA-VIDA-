import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { SettingsProvider } from './SettingsContext';
import { HydrationRemindersProvider } from './HydrationRemindersContext';
import { setOnUnauthorizedCallback } from '../services/api';

function ApiAuthSync() {
  const { logout } = useAuth();
  useEffect(() => {
    setOnUnauthorizedCallback(() => logout());
    return () => setOnUnauthorizedCallback(null);
  }, [logout]);
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


import React, { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { SettingsProvider, useSettings } from './SettingsContext';
import { HydrationRemindersProvider } from './HydrationRemindersContext';
import { RouteTrackingProvider } from './RouteTrackingContext';
import { setApiAuthToken, setOnUnauthorizedCallback, type UnauthorizedContext } from '../services/api';

function normalizeApiIdentity(raw: string): string {
  try {
    const u = new URL(raw.trim());
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.origin}${path}`;
  } catch {
    return raw.trim().replace(/\/+$/, '');
  }
}

function isCurrentBackendRequest(requestBaseUrl: string, configuredBaseUrl: string): boolean {
  const req = normalizeApiIdentity(requestBaseUrl);
  const configured = normalizeApiIdentity(configuredBaseUrl);
  return !!req && !!configured && req === configured;
}

function ApiAuthSync() {
  const { logout, status, user } = useAuth();
  const { settings } = useSettings();
  const logoutInFlightRef = useRef(false);

  useEffect(() => {
    setOnUnauthorizedCallback(async (context: UnauthorizedContext) => {
      if (status !== 'signedIn' || !user?.token) return;
      if (!context.hasAuthToken) return;
      if (!isCurrentBackendRequest(context.baseUrl, settings.apiBaseUrl)) return;
      if (logoutInFlightRef.current) return;
      logoutInFlightRef.current = true;
      try {
        await logout();
      } finally {
        setTimeout(() => {
          logoutInFlightRef.current = false;
        }, 1000);
      }
    });
    return () => setOnUnauthorizedCallback(null);
  }, [logout, settings.apiBaseUrl, status, user?.token]);

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


import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_API_BASE_URL, normalizeApiBaseUrl, STORAGE_KEYS } from '../config';
import { getJson, setJson } from '../services/storage';

export type AppSettings = {
  apiBaseUrl: string;
  fontScale: number;
  soundsEnabled: boolean;
  voiceGuideEnabled: boolean;
  locationPrivacy: 'precise' | 'approx';
  eventsCalendarIcsUrl: string;
};

const defaultSettings: AppSettings = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  fontScale: 1,
  soundsEnabled: true,
  voiceGuideEnabled: false,
  locationPrivacy: 'precise',
  eventsCalendarIcsUrl: '',
};

type SettingsContextValue = {
  settings: AppSettings;
  setApiBaseUrl: (url: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    (async () => {
      const stored = await getJson<AppSettings>(STORAGE_KEYS.settings);
      if (stored?.apiBaseUrl) {
        const normalized = normalizeApiBaseUrl(stored.apiBaseUrl);
        setSettings({ ...defaultSettings, ...stored, apiBaseUrl: normalized });
      }
    })();
  }, []);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (next.apiBaseUrl != null) next.apiBaseUrl = normalizeApiBaseUrl(next.apiBaseUrl);
      void setJson(STORAGE_KEYS.settings, next);
      return next;
    });
  };

  const setApiBaseUrl = (url: string) => updateSettings({ apiBaseUrl: url });

  const value = useMemo(
    () => ({ settings, updateSettings, setApiBaseUrl }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider');
  return ctx;
}


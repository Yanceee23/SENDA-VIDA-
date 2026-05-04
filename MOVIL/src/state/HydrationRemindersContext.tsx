import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { STORAGE_KEYS } from '../config';
import { getJson, setJson } from '../services/storage';

// En Expo Go (SDK 53+) las notificaciones push fueron removidas; no cargar el módulo para evitar ERROR
const isExpoGo = Constants.appOwnership === 'expo';
const Notifications = isExpoGo ? null : require('expo-notifications');

if (!isExpoGo && Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Ignorar si falla (ej. en entornos limitados)
  }
}

type Toggles = {
  duringRoute30m: boolean;
  rest1h: boolean;
  postRoute: boolean;
  food3h: boolean;
};

type Persisted = {
  glassesToday: number;
  toggles: Toggles;
};

type ActiveRouteProgress = {
  distanciaKm: number;
  calorias: number;
  tiempoSegundos: number;
  tipo: 'ciclismo' | 'senderismo' | null;
};

type Ctx = {
  glassesToday: number;
  addGlass: () => void;
  resetGlasses: () => void;

  toggles: Toggles;
  setToggle: (key: keyof Toggles, value: boolean) => Promise<void>;

  routeActive: boolean;
  setRouteActive: (active: boolean) => void;
  activeRouteProgress: ActiveRouteProgress;
  setActiveRouteProgress: (progress: Partial<ActiveRouteProgress>) => void;
  resetActiveRouteProgress: () => void;
  schedulePostRouteIfEnabled: () => Promise<void>;
  notifyExtremeWeather: (message: string) => Promise<void>;
};

const HydrationCtx = createContext<Ctx | null>(null);

const defaultToggles: Toggles = { duringRoute30m: false, rest1h: false, postRoute: false, food3h: false };
const defaultActiveRouteProgress: ActiveRouteProgress = {
  distanciaKm: 0,
  calorias: 0,
  tiempoSegundos: 0,
  tipo: null,
};

export function HydrationRemindersProvider({ children }: { children: React.ReactNode }) {
  const [glassesToday, setGlassesToday] = useState(0);
  const [toggles, setToggles] = useState<Toggles>(defaultToggles);
  const [routeActive, setRouteActive] = useState(false);
  const [activeRouteProgress, setActiveRouteProgressState] = useState<ActiveRouteProgress>(defaultActiveRouteProgress);

  const duringRouteNotifId = useRef<string | null>(null);
  const restNotifId = useRef<string | null>(null);
  const foodNotifId = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      await ensurePermission();
      // Evita duplicados (por reinicios) cancelando notificaciones anteriores de hidratación.
      if (!isExpoGo) {
        try {
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          await Promise.all(
            scheduled
              .filter((n: any) => String((n as any)?.content?.title ?? '') === '💧 Hidratación')
              .map((n: any) => Notifications.cancelScheduledNotificationAsync(String((n as any).identifier)))
          );
        } catch {
          // ignore
        }
      }

      const stored = await getJson<Persisted>(STORAGE_KEYS.hydration);
      if (stored?.toggles) setToggles({ ...defaultToggles, ...stored.toggles });
      if (typeof stored?.glassesToday === 'number') setGlassesToday(Math.max(0, Math.min(8, stored.glassesToday)));
    })();
  }, []);

  const persist = (next: { glassesToday?: number; toggles?: Toggles }) => {
    const value: Persisted = {
      glassesToday: next.glassesToday ?? glassesToday,
      toggles: next.toggles ?? toggles,
    };
    void setJson(STORAGE_KEYS.hydration, value);
  };

  const ensurePermission = async () => {
    if (isExpoGo) return false;
    try {
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status === 'granted') return true;
      const req = await Notifications.requestPermissionsAsync();
      return req.status === 'granted';
    } catch {
      return false;
    }
  };

  const cancelIf = async (id: string | null) => {
    if (!id || isExpoGo) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore
    }
  };

  const scheduleRest1h = async () => {
    if (isExpoGo) return;
    await cancelIf(restNotifId.current);
    try {
      restNotifId.current = await Notifications.scheduleNotificationAsync({
        content: { title: '💧 ¡Hora de hidratarte!', body: 'Recuerda tomar agua y descansar un momento.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 60 * 60, repeats: true },
      });
    } catch {
      restNotifId.current = null;
    }
  };

  const scheduleDuringRoute30m = async () => {
    if (isExpoGo) return;
    await cancelIf(duringRouteNotifId.current);
    try {
      duringRouteNotifId.current = await Notifications.scheduleNotificationAsync({
        content: { title: '💧 ¡Hora de hidratarte!', body: 'Llevas 30 min en ruta. Toma agua.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 60 * 30, repeats: true },
      });
    } catch {
      duringRouteNotifId.current = null;
    }
  };

  const scheduleFood3h = async () => {
    if (isExpoGo) return;
    await cancelIf(foodNotifId.current);
    try {
      foodNotifId.current = await Notifications.scheduleNotificationAsync({
        content: { title: '🍎 ¿Ya comiste?', body: 'Mantén tu energía con algo nutritivo.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 60 * 60 * 3, repeats: true },
      });
    } catch {
      foodNotifId.current = null;
    }
  };

  const syncSchedules = async (nextToggles: Toggles, nextRouteActive: boolean) => {
    if (nextToggles.rest1h) await scheduleRest1h();
    else {
      await cancelIf(restNotifId.current);
      restNotifId.current = null;
    }

    if (nextToggles.duringRoute30m && nextRouteActive) await scheduleDuringRoute30m();
    else {
      await cancelIf(duringRouteNotifId.current);
      duringRouteNotifId.current = null;
    }

    if (nextToggles.food3h) await scheduleFood3h();
    else {
      await cancelIf(foodNotifId.current);
      foodNotifId.current = null;
    }
  };

  const setToggle = async (key: keyof Toggles, value: boolean) => {
    const next = { ...toggles, [key]: value };
    if (value) {
      const ok = await ensurePermission();
      if (!ok) return;
    }
    setToggles(next);
    persist({ toggles: next });
    await syncSchedules(next, routeActive);
  };

  useEffect(() => {
    void syncSchedules(toggles, routeActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeActive]);

  const addGlass = () => {
    setGlassesToday((p) => {
      const next = Math.max(0, Math.min(8, p + 1));
      persist({ glassesToday: next });
      return next;
    });
  };

  const resetGlasses = () => {
    setGlassesToday(0);
    persist({ glassesToday: 0 });
  };

  const schedulePostRouteIfEnabled = async () => {
    if (!toggles.postRoute || isExpoGo) return;
    const ok = await ensurePermission();
    if (!ok) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: '🏆 ¡Ruta completada! Hidrátate para recuperarte.', body: 'Recupera energía y toma agua ahora.' },
        trigger: null,
      });
    } catch {
      // ignore
    }
  };

  const notifyExtremeWeather = async (message: string) => {
    if (isExpoGo || !message.trim()) return;
    const ok = await ensurePermission();
    if (!ok) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Clima extremo detectado',
          body: message,
        },
        trigger: null,
      });
    } catch {
      // ignore
    }
  };

  const setActiveRouteProgress = (progress: Partial<ActiveRouteProgress>) => {
    setActiveRouteProgressState((prev) => ({ ...prev, ...progress }));
  };

  const resetActiveRouteProgress = () => {
    setActiveRouteProgressState(defaultActiveRouteProgress);
  };

  const value = useMemo<Ctx>(
    () => ({
      glassesToday,
      addGlass,
      resetGlasses,
      toggles,
      setToggle,
      routeActive,
      setRouteActive,
      activeRouteProgress,
      setActiveRouteProgress,
      resetActiveRouteProgress,
      schedulePostRouteIfEnabled,
      notifyExtremeWeather,
    }),
    [activeRouteProgress, glassesToday, toggles, routeActive]
  );

  return <HydrationCtx.Provider value={value}>{children}</HydrationCtx.Provider>;
}

export function useHydrationReminders() {
  const ctx = useContext(HydrationCtx);
  if (!ctx) throw new Error('useHydrationReminders debe usarse dentro de HydrationRemindersProvider');
  return ctx;
}


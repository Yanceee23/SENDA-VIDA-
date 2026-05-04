import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

const TRACKING_INTERVAL_MS = 5_000;
const APPROX_FIVE_STEPS_M = 4;

export type GPSPoint = {
  lat: number;
  lng: number;
  heading: number | null;
  speedMps: number | null;
  accuracyM: number | null;
  timestamp: number;
};

type UseGPSState = {
  permissionGranted: boolean;
  loading: boolean;
  error: string | null;
  current: GPSPoint | null;
};

const initialState: UseGPSState = {
  permissionGranted: false,
  loading: false,
  error: null,
  current: null,
};

export function useGPS() {
  const [state, setState] = useState<UseGPSState>(initialState);
  const watchSub = useRef<Location.LocationSubscription | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      const granted = permission.status === 'granted';
      setState((prev) => ({ ...prev, permissionGranted: granted, error: granted ? null : 'Permiso GPS denegado.' }));
      return granted;
    } catch {
      setState((prev) => ({ ...prev, permissionGranted: false, error: 'No se pudo solicitar permiso GPS.' }));
      return false;
    }
  }, []);

  const getCurrent = useCallback(async (): Promise<GPSPoint | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const granted = await requestPermission();
      if (!granted) {
        setState((prev) => ({ ...prev, loading: false }));
        return null;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });
      const point: GPSPoint = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
        speedMps: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
        accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        timestamp: Number(position.timestamp ?? Date.now()),
      };
      setState((prev) => ({ ...prev, loading: false, current: point }));
      return point;
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: 'No se pudo obtener ubicación GPS.' }));
      return null;
    }
  }, [requestPermission]);

  const stopTracking = useCallback(() => {
    watchSub.current?.remove();
    watchSub.current = null;
  }, []);

  const startTracking = useCallback(
    async (onUpdate: (point: GPSPoint) => void): Promise<boolean> => {
      const granted = await requestPermission();
      if (!granted) return false;
      stopTracking();
      try {
        watchSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: TRACKING_INTERVAL_MS,
            distanceInterval: APPROX_FIVE_STEPS_M,
            mayShowUserSettingsDialog: true,
          },
          (position) => {
            const point: GPSPoint = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
              speedMps: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
              accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
              timestamp: Number(position.timestamp ?? Date.now()),
            };
            setState((prev) => ({ ...prev, current: point, error: null }));
            onUpdate(point);
          }
        );
        return true;
      } catch {
        setState((prev) => ({ ...prev, error: 'No se pudo iniciar seguimiento GPS.' }));
        return false;
      }
    },
    [requestPermission, stopTracking]
  );

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    ...state,
    requestPermission,
    getCurrent,
    startTracking,
    stopTracking,
  };
}

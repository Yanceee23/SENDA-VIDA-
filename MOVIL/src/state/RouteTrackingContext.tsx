import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { useGPS, type GPSPoint, type GPSPrecisionMode } from '../hooks/useGPS';
import { useAuth } from './AuthContext';
import { useHydrationReminders } from './HydrationRemindersContext';
import { useSettings } from './SettingsContext';
import { getOsrmRoute } from '../services/osrmService';
import { addTodayStats, syncStatsToBackend } from '../services/statsService';
import { detectExtremeWeather } from '../services/weatherAlertsService';
import { apiRequest, toQuery } from '../services/api';
import { navigationRef } from '../navigation/navigationRef';
import { haversine } from '../utils/geo';
import { calcularCalorias } from '../utils/gps';
import { normalizeLatLng } from '../utils/coordinates';

export type RouteSessionOrigin = 'dashboard' | 'fullScreen';

export type RouteSessionParams = {
  tipo: 'ciclismo' | 'senderismo';
  origin: RouteSessionOrigin;
  rutaId?: number;
  rutaNombre?: string;
  saveToDb?: boolean;
  destLat?: number;
  destLng?: number;
  destNombre?: string;
  routeStartLat?: number;
  routeStartLng?: number;
  nivelSeguridad?: string;
};

type ActivityStartResponse = { id: number };

type ExplorerEnvResponse = {
  especies?: {
    flora?: Array<{ nombre?: string }>;
    floraTotal?: number;
    fauna?: Array<{ nombre?: string }>;
    faunaTotal?: number;
  };
};

const REROUTE_THROTTLE_MS = 25_000;
const REROUTE_PROGRESS_WINDOW_MS = 28_000;
const OFF_ROUTE_THRESHOLD_KM = 0.05;
const MIN_PROGRESS_KM = 0.01;
const MAX_ROUTE_START_DISTANCE_KM = 0.35;
const MIN_DISTANCE_DELTA_KM = 0.0015;
const MAX_DISTANCE_DELTA_KM = 0.25;
const MIN_TRAIL_POINT_DELTA_KM = 0.0012;
const MIN_TIMED_TRAIL_DELTA_KM = 0.00035;
const TRAIL_POINT_INTERVAL_MS = 1_500;
/** Lecturas con peor precisión no suman km pero no bloquean tanto el avance en senderismo */
const GPS_MAX_ACCURACY_M = 115;
/** Mantener polilíneas livianas para evitar bloqueos en dispositivos modestos */
const MAX_TRAIL_POINTS = 450;
const MAX_ROUTE_POINTS = 900;

function decimatePolyline(points: Array<{ lat: number; lng: number }>, maxPoints: number): Array<{ lat: number; lng: number }> {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil((points.length - 1) / (maxPoints - 1));
  const out: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < points.length - 1; i += step) out.push(points[i]);
  out.push(points[points.length - 1]);
  return out;
}

function pointToSegmentDistanceKm(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversine(p.lat, p.lng, a.lat, a.lng);
  const t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq));
  return haversine(p.lat, p.lng, a.lat + t * dy, a.lng + t * dx);
}

function minDistanceToRouteKm(point: { lat: number; lng: number }, routePoints: Array<{ lat: number; lng: number }>): number {
  if (routePoints.length === 0) return Number.POSITIVE_INFINITY;
  if (routePoints.length === 1) return haversine(point.lat, point.lng, routePoints[0].lat, routePoints[0].lng);
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < routePoints.length - 1; i++) {
    const d = pointToSegmentDistanceKm(point, routePoints[i], routePoints[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

type PolylineProjection = {
  segIdx: number;
  t: number;
  lat: number;
  lng: number;
  distKm: number;
};

function projectUserOntoPolyline(
  p: { lat: number; lng: number },
  route: Array<{ lat: number; lng: number }>
): PolylineProjection | null {
  if (route.length < 2) return null;
  let best: PolylineProjection | null = null;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq === 0) t = 0;
    else t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq));
    const lat = a.lat + t * dy;
    const lng = a.lng + t * dx;
    const distKm = haversine(p.lat, p.lng, lat, lng);
    if (!best || distKm < best.distKm) {
      best = { segIdx: i, t, lat, lng, distKm };
    }
  }
  return best;
}

function trimRouteToRemaining(
  userPos: { lat: number; lng: number },
  route: Array<{ lat: number; lng: number }>
): Array<{ lat: number; lng: number }> {
  if (route.length < 2) return route;
  const proj = projectUserOntoPolyline(userPos, route);
  if (!proj || proj.distKm > OFF_ROUTE_THRESHOLD_KM * 2) return route;
  const tail = route.slice(proj.segIdx + 1);
  const cut = { lat: proj.lat, lng: proj.lng };
  if (!tail.length) return route;
  const gapToNextKm = haversine(cut.lat, cut.lng, tail[0].lat, tail[0].lng);
  const remaining = gapToNextKm < 0.0015 ? tail : [cut, ...tail];
  return remaining.length >= 2 ? remaining : route;
}

type RouteTrackingCtx = {
  sessionOrigin: RouteSessionOrigin | null;
  initializing: boolean;
  finishing: boolean;
  current: { lat: number; lng: number } | null;
  startPoint: { lat: number; lng: number } | null;
  heading: number | null;
  points: Array<{ lat: number; lng: number }>;
  plannedRoutePoints: Array<{ lat: number; lng: number }>;
  plannedDurationMin: number | null;
  destination: { lat: number; lng: number } | null;
  distKm: number;
  elapsedSec: number;
  paused: boolean;
  tipo: 'ciclismo' | 'senderismo';
  activityId: number | null;
  finishPoint: { lat: number; lng: number } | null;
  calorias: number;
  permissionGranted: boolean;
  gpsError: string | null;
  destNombre: string | undefined;
  /** UI overlay title */
  routeTitle: string;
  gpsPrecisionMode: GPSPrecisionMode;
  setGpsPrecisionMode: (mode: GPSPrecisionMode) => Promise<void>;
  beginSession: (params: RouteSessionParams) => Promise<boolean>;
  cancelSession: () => void;
  togglePause: () => Promise<void>;
  beginFinishConfirmation: () => void;
  abortFinishConfirmation: () => Promise<void>;
  completeFinalize: () => Promise<void>;
  /** True while hay sesión activa (GPS iniciado o pausado tras arranque válido) */
  isSessionLive: boolean;
};

const Ctx = createContext<RouteTrackingCtx | null>(null);

function navigateToRouteFinished(payload: {
  actividadId?: number;
  summary: {
    distanciaKm: number;
    calorias: number;
    tiempoSegundos: number;
    endLat: number;
    endLng: number;
    tipo: 'ciclismo' | 'senderismo';
  };
  nivelActual?: string;
  floraTotal: number;
  faunaTotal: number;
  floraNombres: string[];
  faunaNombres: string[];
}) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('Tabs', {
    screen: 'Inicio',
    params: {
      screen: 'RouteFinished',
      params: {
        actividadId: payload.actividadId,
        summary: payload.summary,
        autoOpenEnvironment: false,
        nivelActual: payload.nivelActual,
        floraTotal: payload.floraTotal,
        faunaTotal: payload.faunaTotal,
        floraNombres: payload.floraNombres,
        faunaNombres: payload.faunaNombres,
      },
    },
  });
}

export function RouteTrackingProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { status, user } = useAuth();
  const { setRouteActive, setActiveRouteProgress, resetActiveRouteProgress, schedulePostRouteIfEnabled, notifyExtremeWeather } =
    useHydrationReminders();
  const gps = useGPS();

  const [sessionOrigin, setSessionOrigin] = useState<RouteSessionOrigin | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [current, setCurrent] = useState<{ lat: number; lng: number } | null>(null);
  const [startPoint, setStartPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [points, setPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [plannedRoutePoints, setPlannedRoutePoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [plannedDurationMin, setPlannedDurationMin] = useState<number | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [distKm, setDistKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [tipo, setTipo] = useState<'ciclismo' | 'senderismo'>('senderismo');
  const [activityId, setActivityId] = useState<number | null>(null);
  const [finishPoint, setFinishPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [destNombre, setDestNombre] = useState<string | undefined>(undefined);
  const [gpsPrecisionMode, setGpsPrecisionModeState] = useState<GPSPrecisionMode>('high');
  const [meta, setMeta] = useState<{ rutaId?: number; nivelSeguridad?: string; saveToDb: boolean }>({ saveToDb: true });

  const reroutingRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const progressRef = useRef<{ at: number; distToDestKm: number } | null>(null);
  const lastDistancePointRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastTrailPointAtRef = useRef(0);
  const maybeRecalculateRouteRef = useRef<(point: { lat: number; lng: number }) => void>(() => {});
  const pausedRef = useRef(false);
  const finishConfirmationRef = useRef(false);

  const mode = tipo === 'ciclismo' ? 'bike' : 'foot';
  const saveToDb = status === 'signedIn' && user?.userId != null && meta.saveToDb !== false;

  const calorias = useMemo(() => {
    const pesoKg = user?.peso != null && user.peso > 0 ? Number(user.peso) : 70;
    return Math.round(calcularCalorias(distKm, pesoKg, tipo, elapsedSec));
  }, [distKm, elapsedSec, tipo, user?.peso]);

  const routeTitle = destNombre ? `Ruta a ${destNombre}` : tipo === 'ciclismo' ? 'Ruta en bici' : 'Caminata en tiempo real';

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (sessionOrigin == null || startedAt == null) return;
    setActiveRouteProgress({
      distanciaKm: distKm,
      calorias,
      tiempoSegundos: elapsedSec,
      tipo,
    });
  }, [calorias, distKm, elapsedSec, sessionOrigin, setActiveRouteProgress, startedAt, tipo]);

  const updateTimer = useCallback((startTs: number) => {
    const now = Date.now();
    setElapsedSec(Math.max(0, Math.floor((now - startTs) / 1000)));
  }, []);

  useEffect(() => {
    if (!startedAt || paused) return;
    const id = setInterval(() => updateTimer(startedAt), 2000);
    return () => clearInterval(id);
  }, [startedAt, paused, updateTimer]);

  const resetInternalState = useCallback(() => {
    gps.stopTracking();
    setSessionOrigin(null);
    setCurrent(null);
    setStartPoint(null);
    setHeading(null);
    setPoints([]);
    setPlannedRoutePoints([]);
    setPlannedDurationMin(null);
    setDestination(null);
    setDistKm(0);
    setElapsedSec(0);
    setStartedAt(null);
    setPaused(false);
    setActivityId(null);
    setFinishPoint(null);
    setDestNombre(undefined);
    setMeta({ saveToDb: true });
    lastDistancePointRef.current = null;
    lastTrailPointAtRef.current = 0;
    reroutingRef.current = false;
    lastRerouteAtRef.current = 0;
    progressRef.current = null;
    finishConfirmationRef.current = false;
  }, [gps]);

  const cancelSession = useCallback(() => {
    resetInternalState();
    setRouteActive(false);
    resetActiveRouteProgress();
  }, [resetInternalState, resetActiveRouteProgress, setRouteActive]);

  const recalculateRoute = useCallback(
    async (from: { lat: number; lng: number }, dest: { lat: number; lng: number }) => {
      if (reroutingRef.current) return;
      const now = Date.now();
      if (now - lastRerouteAtRef.current < REROUTE_THROTTLE_MS) return;
      reroutingRef.current = true;
      lastRerouteAtRef.current = now;
      try {
        const routeData = await getOsrmRoute({
          mode,
          startLat: from.lat,
          startLng: from.lng,
          endLat: dest.lat,
          endLng: dest.lng,
        });
        const trimmedRoute = trimRouteToRemaining(from, routeData.geometry);
        setPlannedRoutePoints(decimatePolyline(trimmedRoute, MAX_ROUTE_POINTS));
        setPlannedDurationMin(routeData.durationMin);
      } catch {
        // silencioso
      } finally {
        reroutingRef.current = false;
      }
    },
    [mode]
  );

  const maybeRecalculateRoute = useCallback(
    (next: { lat: number; lng: number }) => {
      const dest = destination;
      if (!dest || pausedRef.current) return;
      const now = Date.now();
      const distToDest = haversine(next.lat, next.lng, dest.lat, dest.lng);
      const distToPath = minDistanceToRouteKm(next, plannedRoutePoints);
      const offRoute = Number.isFinite(distToPath) && distToPath > OFF_ROUTE_THRESHOLD_KM;

      const prevProgress = progressRef.current;
      const staleProgress =
        !!prevProgress &&
        now - prevProgress.at >= REROUTE_PROGRESS_WINDOW_MS &&
        distToDest > prevProgress.distToDestKm - MIN_PROGRESS_KM;

      if (!prevProgress || now - prevProgress.at >= REROUTE_PROGRESS_WINDOW_MS) {
        progressRef.current = { at: now, distToDestKm: distToDest };
      }

      if (offRoute || staleProgress) {
        void recalculateRoute(next, dest);
      }
    },
    [destination, plannedRoutePoints, recalculateRoute]
  );

  useEffect(() => {
    maybeRecalculateRouteRef.current = maybeRecalculateRoute;
  }, [maybeRecalculateRoute]);

  const trimPlannedRoute = useCallback((userPos: { lat: number; lng: number }) => {
    setPlannedRoutePoints((prev) => {
      return trimRouteToRemaining(userPos, prev);
    });
  }, []);

  const onGpsUpdate = useCallback(
    (point: GPSPoint) => {
      if (pausedRef.current || finishConfirmationRef.current) return;
      const next = { lat: point.lat, lng: point.lng };
      setHeading(point.heading);
      setCurrent(next);
      setDistKm((prevDistKm) => {
        const last = lastDistancePointRef.current;
        if (!last) {
          lastDistancePointRef.current = next;
          return prevDistKm;
        }
        const delta = haversine(last.lat, last.lng, next.lat, next.lng);
        const lowAccuracy = Number.isFinite(point.accuracyM) && Number(point.accuracyM) > GPS_MAX_ACCURACY_M;
        if (lowAccuracy || delta < MIN_DISTANCE_DELTA_KM || delta > MAX_DISTANCE_DELTA_KM) {
          return prevDistKm;
        }
        lastDistancePointRef.current = next;
        return prevDistKm + delta;
      });
      setPoints((prev) => {
        if (!prev.length) return [next];
        const last = prev[prev.length - 1];
        const delta = haversine(last.lat, last.lng, next.lat, next.lng);
        const now = Number.isFinite(point.timestamp) ? Number(point.timestamp) : Date.now();
        const elapsedSinceTrailPoint = now - lastTrailPointAtRef.current;
        const lowAccuracy = Number.isFinite(point.accuracyM) && Number(point.accuracyM) > GPS_MAX_ACCURACY_M;
        const shouldAppendBySteps = delta >= MIN_TRAIL_POINT_DELTA_KM;
        const shouldAppendByTime = elapsedSinceTrailPoint >= TRAIL_POINT_INTERVAL_MS && delta >= MIN_TIMED_TRAIL_DELTA_KM;
        if (!lowAccuracy && (shouldAppendBySteps || shouldAppendByTime)) {
          lastTrailPointAtRef.current = now;
          const appended = [...prev, next];
          if (appended.length <= MAX_TRAIL_POINTS) return appended;
          return appended.slice(appended.length - MAX_TRAIL_POINTS);
        }
        return prev;
      });
      trimPlannedRoute(next);
      maybeRecalculateRouteRef.current(next);
    },
    [trimPlannedRoute]
  );

  useEffect(() => {
    reroutingRef.current = false;
    lastRerouteAtRef.current = 0;
    progressRef.current = null;
  }, [destination?.lat, destination?.lng]);

  const beginSession = useCallback(
    async (params: RouteSessionParams): Promise<boolean> => {
      cancelSession();
      setInitializing(true);
      setTipo(params.tipo);
      setSessionOrigin(params.origin);
      setMeta({
        rutaId: params.rutaId,
        nivelSeguridad: params.nivelSeguridad,
        saveToDb: params.saveToDb !== false,
      });
      setDestNombre(params.destNombre);
      const destinationCoords = normalizeLatLng(
        params.destLat != null && params.destLng != null ? { lat: params.destLat, lng: params.destLng } : null
      );
      setDestination(destinationCoords);
      const fixedStart = normalizeLatLng(
        params.routeStartLat != null && params.routeStartLng != null
          ? { lat: params.routeStartLat, lng: params.routeStartLng }
          : null
      );

      setRouteActive(true);
      setActiveRouteProgress({ distanciaKm: 0, calorias: 0, tiempoSegundos: 0, tipo: params.tipo });

      try {
        const baseUrl = (settings.apiBaseUrl ?? '').trim();
        const weather = baseUrl ? await detectExtremeWeather(baseUrl) : { shouldAlert: false, message: '', clima: null };
        if (weather.shouldAlert) {
          await notifyExtremeWeather(weather.message);
        }

        const initial = await gps.getCurrent();
        if (!initial) {
          Alert.alert('GPS', gps.error ?? 'No se pudo obtener ubicación.');
          cancelSession();
          return false;
        }

        const gpsStart = { lat: initial.lat, lng: initial.lng };
        const start =
          fixedStart && haversine(gpsStart.lat, gpsStart.lng, fixedStart.lat, fixedStart.lng) > MAX_ROUTE_START_DISTANCE_KM
            ? fixedStart
            : gpsStart;

        setCurrent(start);
        setStartPoint(start);
        setHeading(initial.heading);
        setPoints([start]);
        setDistKm(0);
        lastDistancePointRef.current = start;
        lastTrailPointAtRef.current = initial.timestamp || Date.now();
        const startTs = Date.now();
        setStartedAt(startTs);
        setElapsedSec(0);

        const tripMode = params.tipo === 'ciclismo' ? 'bike' : 'foot';
        if (destinationCoords) {
          try {
            const routeData = await getOsrmRoute({
              mode: tripMode,
              startLat: start.lat,
              startLng: start.lng,
              endLat: destinationCoords.lat,
              endLng: destinationCoords.lng,
            });
            const trimmedRoute = trimRouteToRemaining(start, routeData.geometry);
            setPlannedRoutePoints(decimatePolyline(trimmedRoute, MAX_ROUTE_POINTS));
            setPlannedDurationMin(routeData.durationMin);
          } catch (e: unknown) {
            setPlannedRoutePoints([]);
            setPlannedDurationMin(null);
            Alert.alert('Ruta', e instanceof Error ? e.message : 'No se pudo calcular la ruta.');
          }
        }

        const effectiveSaveToDb = status === 'signedIn' && user?.userId != null && params.saveToDb !== false;

        if (effectiveSaveToDb && baseUrl) {
          const usuarioId = Number(user.userId);
          const act = await apiRequest<ActivityStartResponse>(
            baseUrl,
            `/actividades/iniciar?usuarioId=${usuarioId}&rutaId=${params.rutaId ?? ''}&tipo=${params.tipo}`,
            { method: 'POST', token: user?.token }
          );
          setActivityId(Number(act.id));
        }

        const ok = await gps.startTracking(onGpsUpdate, { precisionMode: gpsPrecisionMode });
        if (!ok) {
          Alert.alert('GPS', gps.error ?? 'No se pudo iniciar seguimiento.');
          cancelSession();
          return false;
        }
        return true;
      } catch (e: unknown) {
        Alert.alert('Ruta', e instanceof Error ? e.message : 'No se pudo iniciar la ruta.');
        cancelSession();
        return false;
      } finally {
        setInitializing(false);
      }
    },
    [
      cancelSession,
      gps,
      notifyExtremeWeather,
      onGpsUpdate,
      setActiveRouteProgress,
      setRouteActive,
      settings.apiBaseUrl,
      status,
      user?.token,
      user?.userId,
      gpsPrecisionMode,
    ]
  );

  const setGpsPrecisionMode = useCallback(
    async (mode: GPSPrecisionMode) => {
      setGpsPrecisionModeState(mode);
      const shouldRestartLiveTracking = sessionOrigin != null && startedAt != null && !pausedRef.current && !finishConfirmationRef.current;
      if (!shouldRestartLiveTracking) return;
      await gps.startTracking(onGpsUpdate, { precisionMode: mode });
    },
    [gps, onGpsUpdate, sessionOrigin, startedAt]
  );

  const togglePause = useCallback(async () => {
    const nextPaused = !pausedRef.current;
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
    if (nextPaused) {
      gps.stopTracking();
      if (current) lastDistancePointRef.current = current;
      return;
    }
    await gps.startTracking(onGpsUpdate, { precisionMode: gpsPrecisionMode });
  }, [current, gps, onGpsUpdate, gpsPrecisionMode]);

  const beginFinishConfirmation = useCallback(() => {
    if (!current) return;
    finishConfirmationRef.current = true;
    gps.stopTracking();
    setFinishPoint(current);
  }, [current, gps]);

  const abortFinishConfirmation = useCallback(async () => {
    finishConfirmationRef.current = false;
    setFinishPoint(null);
    if (!pausedRef.current) {
      await gps.startTracking(onGpsUpdate);
    }
  }, [gps, onGpsUpdate]);

  const completeFinalize = useCallback(async () => {
    const endLat = current?.lat ?? 0;
    const endLng = current?.lng ?? 0;
    try {
      setFinishing(true);
      finishConfirmationRef.current = false;
      const baseUrl = (settings.apiBaseUrl ?? '').trim();
      const aid = activityId;
      if (saveToDb && aid && baseUrl) {
        await apiRequest(baseUrl, `/actividades/${aid}/finalizar`, {
          method: 'PUT',
          token: user?.token,
          body: JSON.stringify({
            distanciaKm: distKm,
            calorias,
            tiempoSegundos: elapsedSec,
          }),
        });
      }

      const today = new Date();
      try {
        await addTodayStats(distKm, calorias, elapsedSec, today);
      } catch {
        Alert.alert('Estadísticas', 'No se pudieron guardar los datos del día. Se intentará en la próxima ruta.');
      }
      if (saveToDb && user?.userId && baseUrl) {
        try {
          await syncStatsToBackend(
            baseUrl,
            {
              userId: user.userId,
              fecha: today.toISOString().split('T')[0],
              distanciaKm: distKm,
              calorias,
              tipo,
            },
            user.token
          );
        } catch {
          Alert.alert('Sincronización', 'No se pudo sincronizar al servidor, pero tu ruta sí se guardó en el celular.');
        }
      }

      await schedulePostRouteIfEnabled();

      const nivelActual = meta.nivelSeguridad ?? '—';
      let floraTotal = 0;
      let faunaTotal = 0;
      let floraNombres: string[] = [];
      let faunaNombres: string[] = [];

      const pos = current;
      if (pos) {
        let envRes: ExplorerEnvResponse | null = null;
        if (baseUrl) {
          const explorerPromise = apiRequest<ExplorerEnvResponse>(
            baseUrl,
            `/explorer/explorar${toQuery({
              lat: pos.lat,
              lng: pos.lng,
              nombre: destNombre ?? 'Lugar visitado',
              tipo: 'parque',
            })}`,
            { method: 'POST', timeoutMs: 6000 }
          );
          const timeoutPromise = new Promise<null>((res) => setTimeout(() => res(null), 5000));
          envRes = await Promise.race([explorerPromise.catch(() => null), timeoutPromise]);
        }
        if (
          !envRes?.especies ||
          (Number(envRes.especies?.floraTotal ?? 0) === 0 && Number(envRes.especies?.faunaTotal ?? 0) === 0)
        ) {
          const { getEspeciesPorUbicacion } = await import('../services/gbifService');
          const especies = await getEspeciesPorUbicacion(pos.lat, pos.lng, 15);
          floraTotal = especies.floraTotal;
          faunaTotal = especies.faunaTotal;
          floraNombres = especies.flora.map((x) => x.nombre).filter(Boolean).slice(0, 5);
          faunaNombres = especies.fauna.map((x) => x.nombre).filter(Boolean).slice(0, 5);
        } else if (envRes?.especies) {
          floraTotal = Number(envRes.especies?.floraTotal ?? 0);
          faunaTotal = Number(envRes.especies?.faunaTotal ?? 0);
          floraNombres = (Array.isArray(envRes.especies?.flora) ? envRes.especies.flora : [])
            .map((x) => String(x?.nombre ?? '').trim())
            .filter(Boolean)
            .slice(0, 5);
          faunaNombres = (Array.isArray(envRes.especies?.fauna) ? envRes.especies.fauna : [])
            .map((x) => String(x?.nombre ?? '').trim())
            .filter(Boolean)
            .slice(0, 5);
        }
      }

      resetInternalState();
      setRouteActive(false);
      resetActiveRouteProgress();

      navigateToRouteFinished({
        actividadId: aid ?? undefined,
        summary: {
          distanciaKm: distKm,
          calorias,
          tiempoSegundos: elapsedSec,
          endLat,
          endLng,
          tipo,
        },
        nivelActual,
        floraTotal,
        faunaTotal,
        floraNombres,
        faunaNombres,
      });
    } catch (e: unknown) {
      Alert.alert('Finalizar', e instanceof Error ? e.message : 'No se pudo finalizar la ruta.');
    } finally {
      setFinishing(false);
    }
  }, [
    activityId,
    calorias,
    current,
    destNombre,
    distKm,
    elapsedSec,
    meta.nivelSeguridad,
    resetActiveRouteProgress,
    resetInternalState,
    saveToDb,
    schedulePostRouteIfEnabled,
    settings.apiBaseUrl,
    setRouteActive,
    tipo,
    user?.token,
    user?.userId,
  ]);

  const isSessionLive = sessionOrigin != null && startedAt != null;

  const value = useMemo<RouteTrackingCtx>(
    () => ({
      sessionOrigin,
      initializing,
      finishing,
      current,
      startPoint,
      heading,
      points,
      plannedRoutePoints,
      plannedDurationMin,
      destination,
      distKm,
      elapsedSec,
      paused,
      tipo,
      activityId,
      finishPoint,
      calorias,
      permissionGranted: gps.permissionGranted,
      gpsError: gps.error,
      destNombre,
      routeTitle,
      gpsPrecisionMode,
      setGpsPrecisionMode,
      beginSession,
      cancelSession,
      togglePause,
      beginFinishConfirmation,
      abortFinishConfirmation,
      completeFinalize,
      isSessionLive,
    }),
    [
      sessionOrigin,
      initializing,
      finishing,
      current,
      startPoint,
      heading,
      points,
      plannedRoutePoints,
      plannedDurationMin,
      destination,
      distKm,
      elapsedSec,
      paused,
      tipo,
      activityId,
      finishPoint,
      calorias,
      gps.permissionGranted,
      gps.error,
      destNombre,
      routeTitle,
      gpsPrecisionMode,
      setGpsPrecisionMode,
      beginSession,
      cancelSession,
      togglePause,
      beginFinishConfirmation,
      abortFinishConfirmation,
      completeFinalize,
      isSessionLive,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRouteTracking(): RouteTrackingCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRouteTracking debe usarse dentro de RouteTrackingProvider');
  return ctx;
}

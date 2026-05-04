// Viene del .env (EXPO_PUBLIC_API_BASE_URL).
const ENV_API_BASE_URL = String(process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

export const PRODUCTION_API_BASE_URL = 'https://senda-vida.onrender.com/api';
// Se mantiene por compatibilidad en la UI de ajustes.
export const EMULATOR_API_BASE_URL = PRODUCTION_API_BASE_URL;
// Sin env, la app apunta al backend de producción en Render.
export const DEFAULT_API_BASE_URL = normalizeApiBaseUrl(ENV_API_BASE_URL || PRODUCTION_API_BASE_URL);

// Normaliza protocolo y fuerza el sufijo /api.
export function normalizeApiBaseUrl(raw: string): string {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    let path = u.pathname.replace(/\/+$/, '');
    if (!path.endsWith('/api')) path = path ? `${path}/api` : '/api';
    return `${u.origin}${path}`;
  } catch {
    return s.endsWith('/api') ? s : s.replace(/\/+$/, '') + '/api';
  }
}

export const GEMINI_API_KEY = String(process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
// Endpoint v1beta de la API Gemini (REST).
export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function toPositiveNumberOrDefault(raw: string | undefined, defaultValue: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export const GBIF_SEARCH_RADIUS_KM = toPositiveNumberOrDefault(
  process.env.EXPO_PUBLIC_GBIF_SEARCH_RADIUS_KM,
  2
);

// Si uno falla o se satura (429), se prueba el siguiente de la lista.
export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
] as const;

// Firebase RTDB para el chat; keys en el .env.
export const FIREBASE_CONFIG = {
  apiKey: String(process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '').trim(),
  authDomain: String(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '').trim(),
  databaseURL: String(process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '').trim(),
  projectId: String(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '').trim(),
  storageBucket: String(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '').trim(),
  messagingSenderId: String(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '').trim(),
  appId: String(process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '').trim(),
};

export const STORAGE_KEYS = {
  auth: 'SV_AUTH_V1',
  settings: 'SV_SETTINGS_V2',
  hydration: 'SV_HYDRATION_V1',
  offlineRoutes: 'SV_OFFLINE_ROUTES_V1',
  pushToken: 'SV_PUSH_TOKEN_V1',
  eventReminders: 'SV_EVENT_REMINDERS_V1',
  pendingInvite: 'SV_PENDING_INVITE_V1',
  statsPrefix: 'stats_',
  // Prefix v2 para no mezclar con cachés viejos (p.ej. listas vacías un día guardadas).
  overpassCachePrefix: 'SV_OVERPASS_V2_',
  lastRouteAdvice: 'SV_LAST_ROUTE_ADVICE',
};

export function getDailyStatsKey(date: Date = new Date()): string {
  const hoy = date.toISOString().split('T')[0];
  return `${STORAGE_KEYS.statsPrefix}${hoy}`;
}


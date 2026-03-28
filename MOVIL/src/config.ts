// Define EXPO_PUBLIC_API_BASE_URL por entorno (dev/staging/prod) para evitar IPs locales hardcodeadas.
const ENV_API_BASE_URL = String(process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

// Solo para el botón "Emulador" en Ajustes. NO usar como default en celular físico.
export const EMULATOR_API_BASE_URL = 'http://10.0.2.2:8084/api';
// Priorizar env; si vacío, el usuario debe configurar en Ajustes → Conexión.
export const DEFAULT_API_BASE_URL = ENV_API_BASE_URL ? normalizeApiBaseUrl(ENV_API_BASE_URL) : '';

/**
 * Normaliza la URL base de la API para evitar errores de conexión.
 * - Asegura esquema http/https
 * - Añade puerto 8084 si falta
 * - Añade sufijo /api si falta
 */
export function normalizeApiBaseUrl(raw: string): string {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    if (!u.port && (u.hostname === 'localhost' || u.hostname === '10.0.2.2' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(u.hostname))) {
      u.port = '8084';
    }
    let path = u.pathname.replace(/\/+$/, '');
    if (!path.endsWith('/api')) path = path ? `${path}/api` : '/api';
    return `${u.origin}${path}`;
  } catch {
    return s.endsWith('/api') ? s : s.replace(/\/+$/, '') + '/api';
  }
}

export const GEMINI_API_KEY = String(process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const;

/** Firebase Realtime Database para chat comunitario. Configura en .env */
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
  overpassCachePrefix: 'SV_OVERPASS_',
  lastRouteAdvice: 'SV_LAST_ROUTE_ADVICE',
};

export function getDailyStatsKey(date: Date = new Date()): string {
  const hoy = date.toISOString().split('T')[0];
  return `${STORAGE_KEYS.statsPrefix}${hoy}`;
}


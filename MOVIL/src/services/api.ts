export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

/** Mensaje legible para Alertas/UI a partir del error lanzado por apiRequest() u otros Error. */
export function formatApiErrorMessage(e: unknown): string {
  if (e != null && typeof e === 'object' && 'message' in e && typeof (e as ApiError).message === 'string') {
    return (e as ApiError).message;
  }
  if (e instanceof Error) return e.message || 'Error desconocido.';
  const s = String(e ?? '').trim();
  return s || 'Error desconocido.';
}

/** Título/contexto opcional por código HTTP para mensajes al usuario */
export function userFacingHttpHint(status: number): string | null {
  if (status === 400) return 'Revisa los datos e inténtalo de nuevo.';
  if (status === 401) return 'Sesión caducada o no autorizada. Inicia sesión de nuevo.';
  if (status === 403) return 'No tienes permiso para esta acción.';
  if (status === 404) return 'No se encontró el recurso en el servidor. ¿La dirección API es correcta?';
  if (status >= 500) return 'El servidor tiene un problema. Prueba más tarde.';
  return null;
}

let onUnauthorized: (() => void) | null = null;
let authToken: string | null = null;

export function setOnUnauthorizedCallback(cb: (() => void) | null) {
  onUnauthorized = cb;
}

export function setApiAuthToken(token: string | null) {
  authToken = token && token.trim() ? token.trim() : null;
}

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestInit & { token?: string; timeoutMs?: number } = {}
): Promise<T> {
  const trimmed = (baseUrl ?? '').trim();
  if (!trimmed) {
    const err: ApiError = {
      status: 0,
      message: 'Configura la URL del backend en Ajustes → Conexión (API).',
      details: { path },
    };
    throw err;
  }
  const url = `${trimmed.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const headers = new Headers(options.headers || {});

  const isFormData =
    typeof FormData !== 'undefined' && options.body && options.body instanceof FormData;

  if (!headers.has('Content-Type') && options.body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  const requestToken = options.token ?? authToken;
  if (requestToken) headers.set('Authorization', `Bearer ${requestToken}`);

  const timeoutMs = options.timeoutMs ?? 240000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Timeout robusto con Promise.race: funciona aunque AbortController falle en Android
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Tiempo de espera agotado')), timeoutMs)
  );

  const fetchPromise = (async (): Promise<Response> => {
    try {
      return await fetch(url, {
        ...options,
        headers,
        signal: options.signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  })();

  let res: Response;
  try {
    res = await Promise.race([fetchPromise, timeoutPromise]);
  } catch (e: any) {
    clearTimeout(timer);
    const msg = String(e?.message ?? e ?? 'Network request failed');
    const isAbort =
      msg.toLowerCase().includes('aborted') ||
      msg.toLowerCase().includes('abort') ||
      msg === 'Tiempo de espera agotado';
    const err: ApiError = {
      status: 0,
      message: isAbort
        ? `Tiempo de espera agotado al conectar con ${baseUrl}`
        : `No se pudo conectar con ${baseUrl}. Detalle: ${msg}`,
      details: { url },
    };
    throw err;
  }

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    if (res.status === 401) {
      onUnauthorized?.();
    }
    const msg =
      (data && typeof data === 'object' && ('error' in data ? (data as any).error : (data as any).message)) ||
      `Error HTTP ${res.status}`;
    const err: ApiError = { status: res.status, message: String(msg), details: data };
    throw err;
  }
  return data as T;
}

export function toQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}


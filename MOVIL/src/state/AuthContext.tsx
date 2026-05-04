import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../config';
import { apiRequest } from '../services/api';
import { getJson, remove, setJson } from '../services/storage';
import { useSettings } from './SettingsContext';
import { syncFcmTokenToBackend } from '../services/push';

const AUTH_BYPASS_ENABLED = true;
const AUTH_BYPASS_USER_ID = 20;
const AUTH_BYPASS_TOKEN = '';

function coerceUserId(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function coerceOptionalNumber(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number.parseFloat(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Unifica respuesta auth + GET perfil sin depender de setState asíncrono. */
function normalizeAuthPayload(raw: any): AuthUser {
  const token = typeof raw?.token === 'string' ? raw.token.trim() : '';
  const userId = coerceUserId(raw?.userId ?? raw?.usuarioId ?? raw?.id);
  if (!token)
    throw new Error('Respuesta inválida del servidor (sin token). Comprueba que la URL de la API termine en /api.');
  if (userId == null)
    throw new Error(
      'Respuesta inválida del servidor (sin identificador de usuario). ¿La app está actualizada y el backend es el correcto?'
    );

  const pesoN = coerceOptionalNumber(raw?.peso);
  const alturaN = coerceOptionalNumber(raw?.altura);
  const edadN = coerceOptionalNumber(raw?.edad);
  let puntosEco: number | undefined;
  const peRaw = raw?.puntosEco;
  if (peRaw != null) {
    const n = coerceOptionalNumber(peRaw);
    if (n !== undefined) puntosEco = Math.round(n);
  }

  return {
    token,
    userId,
    nombre: typeof raw?.nombre === 'string' ? raw.nombre.trim() || 'Usuario' : 'Usuario',
    correo: typeof raw?.correo === 'string' ? raw.correo.trim() : '',
    puntosEco,
    foto: raw?.foto ?? null,
    genero: raw?.genero != null ? String(raw.genero) : null,
    preferencia: raw?.preferencia != null ? String(raw.preferencia) : null,
    edad: edadN ?? null,
    peso: pesoN ?? null,
    altura: alturaN ?? null,
  };
}

async function mergePerfilServidor(apiBaseUrl: string, session: AuthUser): Promise<AuthUser> {
  const perfil = await apiRequest<any>(apiBaseUrl, `/usuarios/${session.userId}`, { token: session.token });
  const pesoN = coerceOptionalNumber(perfil?.peso);
  const alturaN = coerceOptionalNumber(perfil?.altura);
  const edadN = coerceOptionalNumber(perfil?.edad);

  let puntosEco = session.puntosEco;
  if (perfil?.puntosEco != null) {
    const n = coerceOptionalNumber(perfil.puntosEco);
    if (n !== undefined) puntosEco = Math.round(n);
  }

  const next: AuthUser = {
    ...session,
    nombre: perfil?.nombre != null ? String(perfil.nombre).trim() || session.nombre : session.nombre,
    correo: perfil?.correo != null ? String(perfil.correo).trim() || session.correo : session.correo,
    foto: perfil?.foto !== undefined ? perfil.foto : session.foto,
    genero: perfil?.genero != null ? String(perfil.genero) : session.genero ?? null,
    preferencia: perfil?.preferencia != null ? String(perfil.preferencia) : session.preferencia ?? null,
    edad: edadN ?? session.edad ?? null,
    peso: pesoN ?? session.peso ?? null,
    altura: alturaN ?? session.altura ?? null,
    puntosEco,
  };
  return next;
}

function profileHydrationKey(apiBaseUrl: string, userId: number, token: string): string {
  return `${apiBaseUrl}\u001e${userId}\u001e${token}`;
}

function safeSyncPush(baseUrl: string, token: string, userId: number) {
  void syncFcmTokenToBackend({ baseUrl, authToken: token, userId }).catch(() => {});
}

export type AuthUser = {
  token: string;
  userId: number;
  nombre: string;
  correo: string;
  puntosEco?: number;
  foto?: string | null;
  genero?: string | null;
  preferencia?: string | null;
  edad?: number | null;
  peso?: number | null;
  altura?: number | null;
};

type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'guest';

type RegisterInput = {
  nombre: string;
  edad?: number;
  peso?: number;
  altura?: number;
  correo: string;
  password: string;
  genero?: string;
  preferencia?: string;
  foto?: string;
};

type LoginInput = {
  correo: string;
  password: string;
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  continueAsGuest: () => void;
  requireUserId: () => number;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
  refreshUserProfile: (sessionOverride?: AuthUser) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function createBypassSession(): AuthUser {
  return {
    token: AUTH_BYPASS_TOKEN,
    userId: AUTH_BYPASS_USER_ID,
    nombre: 'Invitado',
    correo: '',
    puntosEco: 0,
    foto: null,
    genero: null,
    preferencia: null,
    edad: null,
    peso: null,
    altura: null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  /** Evita llamadas repetidas innecesarias al perfil cuando user/token/id no cambian de sesión */
  const lastProfileSyncKey = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      if (AUTH_BYPASS_ENABLED) {
        const session = createBypassSession();
        setUser(session);
        setStatus('signedIn');
        await setJson(STORAGE_KEYS.auth, session);
        return;
      }
      try {
        const stored = await getJson<AuthUser>(STORAGE_KEYS.auth);
        if (stored?.token && stored.userId != null) {
          const session = normalizeAuthPayload(stored);
          setUser(session);
          setStatus('signedIn');
        } else {
          setStatus('signedOut');
        }
      } catch {
        await remove(STORAGE_KEYS.auth);
        setUser(null);
        setStatus('signedOut');
      }
    })();
  }, []);

  useEffect(() => {
    if (AUTH_BYPASS_ENABLED) return;
    if (status !== 'signedIn' || !user?.token || !user.userId) return;
    safeSyncPush(settings.apiBaseUrl, user.token, user.userId);
  }, [status, user?.token, user?.userId, settings.apiBaseUrl]);

  useEffect(() => {
    if (AUTH_BYPASS_ENABLED) return;
    if (status !== 'signedIn' || !user?.token || user.userId == null) return;
    const snap = user;
    const sid = profileHydrationKey(settings.apiBaseUrl, snap.userId, snap.token);
    if (lastProfileSyncKey.current === sid) return;
    lastProfileSyncKey.current = sid;

    let cancelled = false;
    void (async () => {
      try {
        const merged = await mergePerfilServidor(settings.apiBaseUrl, snap);
        if (cancelled) return;
        setUser((prev) => {
          if (!prev || prev.userId !== merged.userId || prev.token !== merged.token) return prev;
          return merged;
        });
        await setJson(STORAGE_KEYS.auth, merged);
      } catch {
        lastProfileSyncKey.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, settings.apiBaseUrl, user?.token, user?.userId]);

  const login = async (input: LoginInput) => {
    if (AUTH_BYPASS_ENABLED) {
      const session = { ...createBypassSession(), correo: input.correo.trim() };
      setUser(session);
      setStatus('signedIn');
      await setJson(STORAGE_KEYS.auth, session);
      return;
    }
    const trimmedCorreo = input.correo.trim();
    const raw = await apiRequest<any>(settings.apiBaseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ correo: trimmedCorreo, password: input.password }),
      timeoutMs: 240000,
    });
    let session = normalizeAuthPayload(raw);
    try {
      session = await mergePerfilServidor(settings.apiBaseUrl, session);
    } catch {
      /* la respuesta de login ya incluye peso cuando el backend está alineado */
    }
    setUser(session);
    setStatus('signedIn');
    lastProfileSyncKey.current = profileHydrationKey(settings.apiBaseUrl, session.userId, session.token);
    await setJson(STORAGE_KEYS.auth, session);
    safeSyncPush(settings.apiBaseUrl, session.token, session.userId);
  };

  const register = async (input: RegisterInput) => {
    if (AUTH_BYPASS_ENABLED) {
      const session = {
        ...createBypassSession(),
        nombre: input.nombre.trim() || 'Invitado',
        correo: input.correo.trim(),
      };
      setUser(session);
      setStatus('signedIn');
      await setJson(STORAGE_KEYS.auth, session);
      return;
    }
    const payload: any = {
      nombre: input.nombre.trim(),
      correo: input.correo.trim(),
      password: input.password,
    };
    if (input.edad != null) payload.edad = input.edad;
    if (input.peso != null) payload.peso = input.peso;
    if (input.altura != null) payload.altura = input.altura;
    if (input.genero) payload.genero = input.genero;
    if (input.preferencia) payload.preferencia = input.preferencia;
    if (input.foto) payload.foto = input.foto;

    const raw = await apiRequest<any>(settings.apiBaseUrl, '/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 240000,
    });
    let session = normalizeAuthPayload(raw);
    try {
      session = await mergePerfilServidor(settings.apiBaseUrl, session);
    } catch {
      /* login/register ya devuelven campos físicos cuando el servidor responde completo */
    }
    setUser(session);
    setStatus('signedIn');
    lastProfileSyncKey.current = profileHydrationKey(settings.apiBaseUrl, session.userId, session.token);
    await setJson(STORAGE_KEYS.auth, session);
    safeSyncPush(settings.apiBaseUrl, session.token, session.userId);
  };

  const logout = async () => {
    if (AUTH_BYPASS_ENABLED) {
      const session = createBypassSession();
      setUser(session);
      setStatus('signedIn');
      await setJson(STORAGE_KEYS.auth, session);
      return;
    }
    setUser(null);
    setStatus('signedOut');
    lastProfileSyncKey.current = null;
    await remove(STORAGE_KEYS.auth);
  };

  const continueAsGuest = () => {
    if (AUTH_BYPASS_ENABLED) {
      const session = createBypassSession();
      setUser(session);
      setStatus('signedIn');
      void setJson(STORAGE_KEYS.auth, session);
      return;
    }
    lastProfileSyncKey.current = null;
    setUser(null);
    setStatus('guest');
  };

  const requireUserId = () => {
    if (AUTH_BYPASS_ENABLED) return AUTH_BYPASS_USER_ID;
    if (!user?.userId) throw new Error('Debes iniciar sesión para usar esta función.');
    return user.userId;
  };

  const updateUser = async (patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      void setJson(STORAGE_KEYS.auth, next);
      return next;
    });
  };

  const refreshUserProfile = async (sessionOverride?: AuthUser) => {
    if (AUTH_BYPASS_ENABLED) return;
    const snapshot = sessionOverride ?? user;
    if (!snapshot?.userId || !snapshot.token) return;
    const next = await mergePerfilServidor(settings.apiBaseUrl, snapshot);
    lastProfileSyncKey.current = profileHydrationKey(settings.apiBaseUrl, next.userId, next.token);
    setUser(next);
    await setJson(STORAGE_KEYS.auth, next);
  };

  const value = useMemo(
    () => ({ status, user, login, register, logout, continueAsGuest, requireUserId, updateUser, refreshUserProfile }),
    [status, user, settings.apiBaseUrl]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}


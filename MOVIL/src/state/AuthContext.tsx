import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../config';
import { apiRequest } from '../services/api';
import { getJson, remove, setJson } from '../services/storage';
import { useSettings } from './SettingsContext';
import { syncFcmTokenToBackend } from '../services/push';

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
  refreshUserProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await getJson<AuthUser>(STORAGE_KEYS.auth);
      if (stored?.token && stored.userId) {
        setUser(stored);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    })();
  }, []);

  useEffect(() => {
    if (status !== 'signedIn' || !user?.token || !user.userId) return;
    void syncFcmTokenToBackend({ baseUrl: settings.apiBaseUrl, authToken: user.token, userId: user.userId });
  }, [status, user?.token, user?.userId, settings.apiBaseUrl]);

  const login = async (input: LoginInput) => {
    const res = await apiRequest<AuthUser>(settings.apiBaseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ correo: input.correo.trim(), password: input.password }),
      timeoutMs: 240000,
    });
    setUser(res);
    setStatus('signedIn');
    await setJson(STORAGE_KEYS.auth, res);
    void syncFcmTokenToBackend({ baseUrl: settings.apiBaseUrl, authToken: res.token, userId: res.userId });
  };

  const register = async (input: RegisterInput) => {
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

    const res = await apiRequest<AuthUser>(settings.apiBaseUrl, '/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 240000,
    });
    setUser(res);
    setStatus('signedIn');
    await setJson(STORAGE_KEYS.auth, res);
    void syncFcmTokenToBackend({ baseUrl: settings.apiBaseUrl, authToken: res.token, userId: res.userId });
  };

  const logout = async () => {
    setUser(null);
    setStatus('signedOut');
    await remove(STORAGE_KEYS.auth);
  };

  const continueAsGuest = () => {
    setUser(null);
    setStatus('guest');
  };

  const requireUserId = () => {
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

  const refreshUserProfile = async () => {
    if (!user?.userId || !user.token) return;
    const perfil = await apiRequest<any>(settings.apiBaseUrl, `/usuarios/${user.userId}`, { token: user.token });
    const next: AuthUser = {
      ...user,
      nombre: String(perfil?.nombre ?? user.nombre),
      correo: String(perfil?.correo ?? user.correo),
      puntosEco: perfil?.puntosEco != null ? Number(perfil.puntosEco) : user.puntosEco,
      genero: perfil?.genero != null ? String(perfil.genero) : user.genero,
      preferencia: perfil?.preferencia != null ? String(perfil.preferencia) : user.preferencia,
      edad: perfil?.edad != null ? Number(perfil.edad) : user.edad,
      peso: perfil?.peso != null ? Number(perfil.peso) : user.peso,
      altura: perfil?.altura != null ? Number(perfil.altura) : user.altura,
    };
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


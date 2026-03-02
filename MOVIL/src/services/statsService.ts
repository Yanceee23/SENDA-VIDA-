import { getDailyStatsKey } from '../config';
import { apiRequest } from './api';
import { getJson, setJson } from './storage';

export type DailyStats = {
  km: number;
  calorias: number;
  tiempoSegundos: number;
};

export type MonthlyStats = {
  km: number;
  calorias: number;
  tiempoSegundos: number;
  rutas: number;
};

export type SaveRouteStatsInput = {
  userId?: number;
  fecha: string;
  distanciaKm: number;
  calorias: number;
  tipo: 'ciclismo' | 'senderismo';
};

function sanitizeStats(value: DailyStats | null): DailyStats {
  return {
    km: Math.max(0, Number(value?.km ?? 0)),
    calorias: Math.max(0, Number(value?.calorias ?? 0)),
    tiempoSegundos: Math.max(0, Math.floor(Number(value?.tiempoSegundos ?? 0))),
  };
}

function sanitizeMonthlyStats(value: MonthlyStats | null): MonthlyStats {
  return {
    km: Math.max(0, Number(value?.km ?? 0)),
    calorias: Math.max(0, Number(value?.calorias ?? 0)),
    tiempoSegundos: Math.max(0, Math.floor(Number(value?.tiempoSegundos ?? 0))),
    rutas: Math.max(0, Math.floor(Number(value?.rutas ?? 0))),
  };
}

function getDiaKey(date: Date = new Date()): string {
  const diaKey = date.toISOString().split('T')[0];
  return `stats_dia_${diaKey}`;
}

function getMesKey(date: Date = new Date()): string {
  return `stats_mes_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function getTodayStats(date: Date = new Date()): Promise<DailyStats> {
  const stored = await getJson<DailyStats>(getDiaKey(date));
  if (stored) return sanitizeStats(stored);
  const legacy = await getJson<DailyStats>(getDailyStatsKey(date));
  return sanitizeStats(legacy);
}

export async function getMonthStats(date: Date = new Date()): Promise<MonthlyStats> {
  const stored = await getJson<MonthlyStats>(getMesKey(date));
  return sanitizeMonthlyStats(stored);
}

export async function getTodayAndMonthStats(date: Date = new Date()): Promise<{ dia: DailyStats; mes: MonthlyStats }> {
  const [dia, mes] = await Promise.all([getTodayStats(date), getMonthStats(date)]);
  return { dia, mes };
}

export async function addTodayStats(km: number, calorias: number, tiempoSegundos: number, date: Date = new Date()): Promise<DailyStats> {
  const distanciaKm = Math.max(0, Number(km));
  const caloriasRuta = Math.max(0, Number(calorias));
  const tiempoRutaSegundos = Math.max(0, Math.floor(Number(tiempoSegundos)));

  const currentDay = await getTodayStats(date);
  const nextDay = {
    km: parseFloat((currentDay.km + distanciaKm).toFixed(2)),
    calorias: Math.round(currentDay.calorias + caloriasRuta),
    tiempoSegundos: currentDay.tiempoSegundos + tiempoRutaSegundos,
  };
  await setJson(getDiaKey(date), nextDay);

  const currentMonth = await getMonthStats(date);
  const nextMonth = {
    km: parseFloat((currentMonth.km + distanciaKm).toFixed(2)),
    calorias: Math.round(currentMonth.calorias + caloriasRuta),
    tiempoSegundos: currentMonth.tiempoSegundos + tiempoRutaSegundos,
    rutas: currentMonth.rutas + 1,
  };
  await setJson(getMesKey(date), nextMonth);

  return nextDay;
}

export async function syncStatsToBackend(baseUrl: string, payload: SaveRouteStatsInput): Promise<void> {
  if (!payload.userId) return;
  await apiRequest(baseUrl, '/estadisticas', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

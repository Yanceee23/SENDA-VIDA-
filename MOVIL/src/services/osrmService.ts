import { apiRequest } from './api';
import { normalizeLatLng } from '../utils/coordinates';

export type OsrmMode = 'foot' | 'bike';

export type OsrmRoute = {
  distanceKm: number;
  durationMin: number;
  geometry: Array<{ lat: number; lng: number }>;
};

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
};

export async function getOsrmRoute(params: {
  mode: OsrmMode;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}): Promise<OsrmRoute> {
  const profile = params.mode === 'bike' ? 'bike' : 'foot';
  const base = 'https://router.project-osrm.org';
  const path = `/route/v1/${profile}/${params.startLng},${params.startLat};${params.endLng},${params.endLat}?overview=simplified&geometries=geojson`;
  const res = await apiRequest<OsrmResponse>(base, path, { method: 'GET', timeoutMs: 30000 });
  const route = Array.isArray(res.routes) ? res.routes[0] : undefined;
  if (!route || !Array.isArray(route.geometry?.coordinates)) {
    throw new Error('No encontramos una ruta disponible para ese destino.');
  }
  const allPoints = route.geometry.coordinates
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map((p) => normalizeLatLng({ lat: p[1], lng: p[0] }, false))
    .filter((p): p is { lat: number; lng: number } => p != null);

  // Cap de puntos para no saturar el hilo JS con rutas muy largas.
  const MAX_ROUTE_PTS = 500;
  let geometry = allPoints;
  if (allPoints.length > MAX_ROUTE_PTS) {
    const step = Math.ceil((allPoints.length - 1) / (MAX_ROUTE_PTS - 1));
    geometry = [];
    for (let i = 0; i < allPoints.length - 1; i += step) geometry.push(allPoints[i]);
    geometry.push(allPoints[allPoints.length - 1]);
  }

  return {
    distanceKm: Math.max(0, Number(route.distance ?? 0) / 1000),
    durationMin: Math.max(0, Number(route.duration ?? 0) / 60),
    geometry,
  };
}

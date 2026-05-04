/**
 * Servicio para obtener flora y fauna desde la API de GBIF según coordenadas GPS.
 * Funciona sin backend - llama directamente a api.gbif.org.
 */

import { haversine } from '../utils/geo';
import { GBIF_SEARCH_RADIUS_KM } from '../config';

const GBIF_BASE = 'https://api.gbif.org/v1';
const SEARCH_RADIUS_KM = GBIF_SEARCH_RADIUS_KM;
const KM_PER_DEGREE_LAT = 111.0;
const MAX_GBIF_RESULTS = 300;

export type EspeciesResult = {
  flora: Array<{ nombre: string }>;
  floraTotal: number;
  fauna: Array<{ nombre: string }>;
  faunaTotal: number;
};

function buildGeometryWkt(lat: number, lng: number): string {
  const latDelta = SEARCH_RADIUS_KM / KM_PER_DEGREE_LAT;
  const lngDelta = SEARCH_RADIUS_KM / (KM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  return `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;
}

async function queryGbifByKingdom(lat: number, lng: number, kingdom: string, limit: number): Promise<{ count: number; items: Array<{ nombre: string }> }> {
  const geometry = buildGeometryWkt(lat, lng);
  const url = `${GBIF_BASE}/occurrence/search?kingdom=${encodeURIComponent(kingdom)}&geometry=${encodeURIComponent(geometry)}&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&limit=${MAX_GBIF_RESULTS}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': 'SendaVidaApp/1.0' },
  });

  if (!res.ok) {
    throw new Error(`GBIF API error: ${res.status}`);
  }

  const json = await res.json();
  const results = json.results ?? [];

  const nombres = new Set<string>();
  for (const occ of results) {
    const occLat = typeof occ.decimalLatitude === 'number' ? occ.decimalLatitude : Number(occ.decimalLatitude);
    const occLng = typeof occ.decimalLongitude === 'number' ? occ.decimalLongitude : Number(occ.decimalLongitude);
    if (!Number.isFinite(occLat) || !Number.isFinite(occLng)) {
      continue;
    }
    const distanceKm = haversine(lat, lng, occLat, occLng);
    if (distanceKm > SEARCH_RADIUS_KM) {
      continue;
    }
    const species = occ.species ? String(occ.species).trim() : '';
    const scientificName = occ.scientificName ? String(occ.scientificName).trim() : '';
    const nombre = species || scientificName;
    if (nombre) nombres.add(nombre);
  }

  const allNombres = Array.from(nombres);
  const items = allNombres.slice(0, limit).map((nombre) => ({ nombre }));
  return { count: allNombres.length, items };
}

/**
 * Obtiene flora y fauna según la ubicación GPS.
 * No requiere backend - usa la API pública de GBIF.
 */
export async function getEspeciesPorUbicacion(lat: number, lng: number, limit = 15): Promise<EspeciesResult> {
  try {
    const [floraData, faunaData] = await Promise.all([
      queryGbifByKingdom(lat, lng, 'Plantae', limit),
      queryGbifByKingdom(lat, lng, 'Animalia', limit),
    ]);

    return {
      flora: floraData.items,
      floraTotal: floraData.count,
      fauna: faunaData.items,
      faunaTotal: faunaData.count,
    };
  } catch (e) {
    console.warn('[GBIF] Error obteniendo especies:', e);
    return {
      flora: [],
      floraTotal: 0,
      fauna: [],
      faunaTotal: 0,
    };
  }
}

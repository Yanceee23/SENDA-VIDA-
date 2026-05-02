import { STORAGE_KEYS } from '../config';
import { getJson, setJson } from './storage';
import { normalizeLatLng } from '../utils/coordinates';

export type PlaceCategory =
  | 'volcanes'
  | 'playas'
  | 'cascadas'
  | 'montanas-parques'
  | 'montanas'
  | 'parques'
  | 'rios'
  | 'lagos';

type OverpassElement = {
  type?: string;
  id?: number | string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type CachePayload = {
  storedAt: number;
  items: OverpassPlace[];
};

export type OverpassPlace = {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: PlaceCategory;
  lat: number;
  lng: number;
};

const BBOX = '(12.0,-90.2,14.5,-87.5)';
const TTL_24H_MS = 24 * 60 * 60 * 1000;

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
] as const;

const FETCH_TIMEOUT_MS = 120_000;
const CLIENT_USER_ERROR = 'No pudimos consultar lugares naturales en este momento.';

const FALLBACK_RIVERS_SV: OverpassPlace[] = [
  { id: 'fallback-river:lempa', nombre: 'Río Lempa', descripcion: 'Río principal de El Salvador', categoria: 'rios', lat: 13.705, lng: -88.86 },
  { id: 'fallback-river:paz', nombre: 'Río Paz', descripcion: 'Río fronterizo entre El Salvador y Guatemala', categoria: 'rios', lat: 13.812, lng: -90.095 },
  { id: 'fallback-river:goascoran', nombre: 'Río Goascorán', descripcion: 'Río fronterizo entre El Salvador y Honduras', categoria: 'rios', lat: 13.47, lng: -87.83 },
  { id: 'fallback-river:torola', nombre: 'Río Torola', descripcion: 'Río del oriente de El Salvador', categoria: 'rios', lat: 13.872, lng: -88.158 },
  { id: 'fallback-river:sumpul', nombre: 'Río Sumpul', descripcion: 'Río del norte de El Salvador', categoria: 'rios', lat: 14.105, lng: -89.09 },
  { id: 'fallback-river:acelhuate', nombre: 'Río Acelhuate', descripcion: 'Río de la zona central de El Salvador', categoria: 'rios', lat: 13.738, lng: -89.16 },
  { id: 'fallback-river:sucio', nombre: 'Río Sucio', descripcion: 'Río de la zona occidental-central de El Salvador', categoria: 'rios', lat: 13.775, lng: -89.44 },
  { id: 'fallback-river:jiboa', nombre: 'Río Jiboa', descripcion: 'Río de la zona paracentral de El Salvador', categoria: 'rios', lat: 13.547, lng: -88.98 },
  { id: 'fallback-river:grande-san-miguel', nombre: 'Río Grande de San Miguel', descripcion: 'Río del oriente de El Salvador', categoria: 'rios', lat: 13.452, lng: -88.165 },
  { id: 'fallback-river:sensunapan', nombre: 'Río Sensunapán', descripcion: 'Río del occidente de El Salvador', categoria: 'rios', lat: 13.71, lng: -89.72 },
];

const FALLBACK_LAKES_SV: OverpassPlace[] = [
  { id: 'fallback-lake:ilopango', nombre: 'Lago de Ilopango', descripcion: 'Lago ubicado entre San Salvador, Cuscatlán y La Paz', categoria: 'lagos', lat: 13.672, lng: -89.055 },
  { id: 'fallback-lake:cerron-grande', nombre: 'Embalse Cerrón Grande', descripcion: 'Embalse del río Lempa', categoria: 'lagos', lat: 14.05, lng: -89.05 },
  { id: 'fallback-lake:guija', nombre: 'Lago de Güija', descripcion: 'Lago compartido entre El Salvador y Guatemala', categoria: 'lagos', lat: 14.27, lng: -89.51 },
  { id: 'fallback-lake:coatepeque', nombre: 'Lago de Coatepeque', descripcion: 'Lago volcánico de Santa Ana', categoria: 'lagos', lat: 13.864, lng: -89.545 },
  { id: 'fallback-lake:olomega', nombre: 'Laguna de Olomega', descripcion: 'Laguna del oriente de El Salvador', categoria: 'lagos', lat: 13.316, lng: -88.06 },
];

function queryByCategory(category: PlaceCategory): string {
  switch (category) {
    case 'volcanes':
      return `[out:json][timeout:25];
(node["natural"="volcano"]${BBOX};
 way["natural"="volcano"]${BBOX};);
out center;`;
    case 'playas':
      return `[out:json][timeout:25];
(node["natural"="beach"]${BBOX};
 way["natural"="beach"]${BBOX};);
out center;`;
    case 'cascadas':
      return `[out:json][timeout:25];
(node["waterway"="waterfall"]${BBOX};
 way["waterway"="waterfall"]${BBOX};);
out center;`;
    case 'montanas':
      return `[out:json][timeout:25];
(node["natural"="peak"]${BBOX};);
out body;`;
    case 'parques':
      // Incluye parques y reservas aunque no tengan name:* en OSM.
      return `[out:json][timeout:180];
(
relation["boundary"="protected_area"]${BBOX};
relation["leisure"~"^(park|nature_reserve)$"]${BBOX};
node["leisure"~"^(park|nature_reserve)$"]${BBOX};
way["leisure"~"^(park|nature_reserve)$"]${BBOX};
);
out center;`;
    case 'rios':
      return `[out:json][timeout:180];
(
way["waterway"="river"]["name"]${BBOX};
relation["waterway"="river"]["name"]${BBOX};
way["natural"="water"]["water"~"^(river|riverbank)$"]["name"]${BBOX};
relation["natural"="water"]["water"~"^(river|riverbank)$"]["name"]${BBOX};
);
out center;`;
    case 'lagos':
      return `[out:json][timeout:25];
way["natural"="water"]["water"="lake"]${BBOX};
out center;`;
    case 'montanas-parques':
      return `[out:json][timeout:25];
(node["natural"="peak"]${BBOX};
 way["boundary"="protected_area"]${BBOX};
 node["leisure"="nature_reserve"]${BBOX};);
out center;`;
  }
}

function getCacheKey(category: PlaceCategory): string {
  return `${STORAGE_KEYS.overpassCachePrefix}${category}`;
}

function mapElement(element: OverpassElement, category: PlaceCategory): OverpassPlace | null {
  const point = normalizeLatLng({ lat: element.lat ?? element.center?.lat, lng: element.lon ?? element.center?.lon });
  if (!point) return null;
  const tags = element.tags ?? {};
  const nombre =
    String(tags['name:es'] ?? tags.name ?? '').trim() ||
    (category === 'rios' ? `Río ${element.id ?? ''}` : `Lugar ${element.id ?? ''}`).trim();
  const descriptionParts = [tags.description, tags.tourism, tags.natural, tags.leisure, tags.waterway].filter(Boolean);
  return {
    id: `${String(element.type ?? 'x')}:${String(element.id ?? `${point.lat},${point.lng}`)}`,
    nombre,
    descripcion: descriptionParts.length ? String(descriptionParts[0]) : 'Lugar natural en El Salvador',
    categoria: category,
    lat: point.lat,
    lng: point.lng,
  };
}

async function fetchOverpassOnce(url: string, query: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function requestOverpass(query: string): Promise<OverpassResponse> {
  for (const url of OVERPASS_URLS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetchOverpassOnce(url, query);
        if (!response.ok) continue;
        return (await response.json()) as OverpassResponse;
      } catch {
        /* siguiente intento */
      }
    }
  }
  throw new Error(CLIENT_USER_ERROR);
}

export async function getPlacesByCategory(category: PlaceCategory): Promise<OverpassPlace[]> {
  const cacheKey = getCacheKey(category);
  const cached = await getJson<CachePayload>(cacheKey);
  const now = Date.now();
  // [] cuenta como truthy en JS: antes se "congelaban" rutas sin resultados durante 24h.
  const cachedRows = cached?.items;
  if (
    Array.isArray(cachedRows) &&
    cachedRows.length > 0 &&
    now - Number(cached?.storedAt ?? 0) < TTL_24H_MS
  ) {
    return cachedRows;
  }

  const query = queryByCategory(category);
  const raw = await requestOverpass(query);
  const elements = Array.isArray(raw.elements) ? raw.elements : [];
  const mapped = elements.map((e) => mapElement(e, category)).filter((e): e is OverpassPlace => e != null);
  if (mapped.length === 0 && category === 'rios') {
    return FALLBACK_RIVERS_SV;
  }
  if (mapped.length === 0 && category === 'lagos') {
    return FALLBACK_LAKES_SV;
  }
  if (mapped.length > 0) {
    await setJson(cacheKey, { storedAt: now, items: mapped });
  }
  return mapped;
}

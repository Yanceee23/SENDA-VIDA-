import { STORAGE_KEYS } from '../config';
import { getJson, setJson } from './storage';

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
      // No dependemos solo de name/ref: muchos ríos en OSM no tienen etiqueta de nombre.
      return `[out:json][timeout:180];
(
way["waterway"~"^(river|stream)$"]${BBOX};
relation["waterway"~"^(river|stream)$"]${BBOX};
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
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const tags = element.tags ?? {};
  const nombre = String(tags.name ?? tags['name:es'] ?? '').trim() || `Lugar ${element.id ?? ''}`.trim();
  const descriptionParts = [tags.description, tags.tourism, tags.natural, tags.leisure, tags.waterway].filter(Boolean);
  return {
    id: `${String(element.type ?? 'x')}:${String(element.id ?? `${lat},${lng}`)}`,
    nombre,
    descripcion: descriptionParts.length ? String(descriptionParts[0]) : 'Lugar natural en El Salvador',
    categoria: category,
    lat,
    lng,
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
  if (mapped.length > 0) {
    await setJson(cacheKey, { storedAt: now, items: mapped });
  }
  return mapped;
}

import { STORAGE_KEYS } from '../config';
import { getJson, setJson } from './storage';

type PlaceCategory = 'volcanes' | 'playas' | 'cascadas' | 'montanas-parques' | 'montanas' | 'parques';

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
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function queryByCategory(category: PlaceCategory): string {
  switch (category) {
    case 'volcanes':
      return `[out:json];
(node["natural"="volcano"]${BBOX};
 way["natural"="volcano"]${BBOX};);
out body;`;
    case 'playas':
      return `[out:json];
(node["natural"="beach"]${BBOX};
 way["natural"="beach"]${BBOX};);
out body;`;
    case 'cascadas':
      return `[out:json];
(node["waterway"="waterfall"]${BBOX};);
out body;`;
    case 'montanas':
      return `[out:json];
(node["natural"="peak"]${BBOX};);
out body;`;
    case 'parques':
      return `[out:json];
(way["boundary"="protected_area"]${BBOX};
 node["leisure"="nature_reserve"]${BBOX};);
out body;`;
    case 'montanas-parques':
    default:
      return `[out:json];
(node["natural"="peak"]${BBOX};
 way["boundary"="protected_area"]${BBOX};
 node["leisure"="nature_reserve"]${BBOX};);
out body;`;
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

async function requestOverpass(query: string): Promise<OverpassResponse> {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    throw new Error('No pudimos consultar lugares naturales en este momento.');
  }
  return (await response.json()) as OverpassResponse;
}

export async function getPlacesByCategory(category: PlaceCategory): Promise<OverpassPlace[]> {
  const cacheKey = getCacheKey(category);
  const cached = await getJson<CachePayload>(cacheKey);
  const now = Date.now();
  if (cached?.items && now - Number(cached.storedAt ?? 0) < TTL_24H_MS) {
    return cached.items;
  }

  const query = queryByCategory(category);
  const raw = await requestOverpass(query);
  const elements = Array.isArray(raw.elements) ? raw.elements : [];
  const mapped = elements.map((e) => mapElement(e, category)).filter((e): e is OverpassPlace => e != null);
  await setJson(cacheKey, { storedAt: now, items: mapped });
  return mapped;
}

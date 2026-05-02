import { apiRequest, toQuery } from './api';
import type { OverpassPlace, PlaceCategory } from './overpassService';

type ApiItem = {
  osm_type?: string;
  osm_id?: number | string;
  nombre?: string;
  lat?: number;
  lng?: number;
  tags?: Record<string, unknown>;
};

function tagLine(tags: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = tags?.[key];
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function mapEcoItemToOverpass(it: ApiItem, categoria: PlaceCategory): OverpassPlace | null {
  const osmType = String(it.osm_type ?? '').trim();
  const osmId = it.osm_id;
  if (!osmType || osmId == null) return null;
  const lat = Number(it.lat);
  const lng = Number(it.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const nombre = String(it.nombre ?? '').trim();
  if (!nombre) return null;
  const tags = it.tags ?? {};
  const descriptionParts = [
    tagLine(tags, 'description'),
    tagLine(tags, 'tourism'),
    tagLine(tags, 'natural'),
    tagLine(tags, 'leisure'),
    tagLine(tags, 'waterway'),
  ].filter(Boolean);
  return {
    id: `${osmType}:${osmId}`,
    nombre,
    descripcion: descriptionParts.length ? String(descriptionParts[0]) : 'Lugar natural en El Salvador',
    categoria,
    lat,
    lng,
  };
}

export async function fetchEcoPlacesFromBackend(
  baseUrl: string,
  tipo: PlaceCategory,
  token?: string
): Promise<OverpassPlace[]> {
  const all: OverpassPlace[] = [];
  let page = 0;
  const size = 50;

  while (true) {
    const path = `/geo/ecolugares${toQuery({ tipo, page, size })}`;
    const data = await apiRequest<{ items?: ApiItem[]; total?: number }>(baseUrl, path, {
      method: 'GET',
      token,
      timeoutMs: 240_000,
    });
    const items = data.items ?? [];
    for (const it of items) {
      const m = mapEcoItemToOverpass(it, tipo);
      if (m) all.push(m);
    }
    if (items.length < size) break;
    if (typeof data.total === 'number' && all.length >= data.total) break;
    page += 1;
  }

  return all;
}

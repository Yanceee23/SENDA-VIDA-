/**
 * POIs cercanos usando Overpass (OpenStreetMap).
 * Funciona sin backend - para EnvironmentalInfoScreen.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type PoiResult = {
  nombre: string;
  tipo?: string;
  distancia_km: number;
};

export async function getNearbyPois(lat: number, lng: number, radiusM = 8000, limit = 8): Promise<PoiResult[]> {
  const r = Math.max(500, Math.min(radiusM, 50000));
  try {
    const query = `[out:json][timeout:25];(
      node["tourism"~"^(attraction|museum|information|viewpoint)$"](around:${r},${lat},${lng});
      way["tourism"~"^(attraction|museum|information|viewpoint)$"](around:${r},${lat},${lng});
      node["historic"~"^(archaeological_site|ruins|monument|memorial|castle|fort|temple)$"](around:${r},${lat},${lng});
      way["historic"~"^(archaeological_site|ruins|monument|memorial|castle|fort|temple)$"](around:${r},${lat},${lng});
      node["natural"~"^(peak|volcano|beach|cave_entrance|spring)$"](around:${r},${lat},${lng});
      way["natural"~"^(peak|volcano|beach|cave_entrance|spring)$"](around:${r},${lat},${lng});
      node["amenity"~"^(parking|restaurant|cafe|hospital|pharmacy|place_of_worship)$"](around:${r},${lat},${lng});
      way["amenity"~"^(parking|restaurant|cafe|hospital|pharmacy|place_of_worship)$"](around:${r},${lat},${lng});
      node["leisure"~"^(park|nature_reserve|garden)$"](around:${r},${lat},${lng});
      way["leisure"~"^(park|nature_reserve|garden)$"](around:${r},${lat},${lng});
    );out center;`;

    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { elements?: Array<Record<string, unknown>> };
    const elements = json.elements ?? [];
    const seen = new Set<string>();
    const results: PoiResult[] = [];

    for (const el of elements) {
      const type = String(el.type ?? '');
      const id = el.id;
      if (!id) continue;
      const tags = (el.tags as Record<string, string>) ?? {};
      if (tags.barrier) continue;

      let pLat: number | null = null;
      let pLng: number | null = null;
      if (type === 'node') {
        pLat = Number(el.lat);
        pLng = Number(el.lon);
      } else {
        const center = el.center as { lat?: number; lon?: number } | undefined;
        if (center) {
          pLat = Number(center.lat);
          pLng = Number(center.lon);
        }
      }
      if (pLat == null || pLng == null || !Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;

      const key = `${type}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const nombre =
        (tags['name:es'] ?? tags.name ?? '').trim() ||
        buildFallbackName(tags) ||
        'Punto de interés';
      const kind = tags.tourism ?? tags.historic ?? tags.natural ?? tags.amenity ?? tags.leisure;
      const distKm = Math.round(distanciaKm(lat, lng, pLat, pLng) * 100) / 100;
      results.push({ nombre, tipo: kind, distancia_km: distKm });
    }

    results.sort((a, b) => a.distancia_km - b.distancia_km);
    return results.slice(0, limit);
  } catch {
    return [];
  }
}

function buildFallbackName(tags: Record<string, string>): string {
  const kind = tags.tourism ?? tags.historic ?? tags.natural ?? tags.amenity ?? tags.leisure;
  return kind ? `Punto de interés (${kind})` : 'Punto de interés';
}

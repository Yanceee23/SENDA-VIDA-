import type { LatLng } from './gps';

const SV_BOUNDS = {
  minLat: 13.0,
  maxLat: 14.6,
  minLng: -90.2,
  maxLng: -87.6,
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function isLatLngInElSalvador(point: LatLng): boolean {
  return (
    point.lat >= SV_BOUNDS.minLat &&
    point.lat <= SV_BOUNDS.maxLat &&
    point.lng >= SV_BOUNDS.minLng &&
    point.lng <= SV_BOUNDS.maxLng
  );
}

export function normalizeLatLng(raw: unknown, requireElSalvador = true): LatLng | null {
  if (!raw) return null;

  let value: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      const parts = trimmed.split(',').map((part) => part.trim());
      if (parts.length < 2) return null;
      value = { lat: parts[0], lng: parts[1] };
    }
  }

  if (Array.isArray(value) && value.length >= 2) {
    const first = toFiniteNumber(value[0]);
    const second = toFiniteNumber(value[1]);
    if (first == null || second == null) return null;

    const asLatLng = { lat: first, lng: second };
    const asLngLat = { lat: second, lng: first };
    if (!requireElSalvador || isLatLngInElSalvador(asLatLng)) return asLatLng;
    if (isLatLngInElSalvador(asLngLat)) return asLngLat;
    return null;
  }

  if (typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const lat = toFiniteNumber(obj.lat ?? obj.latitude);
  const lng = toFiniteNumber(obj.lng ?? obj.lon ?? obj.longitude);
  if (lat == null || lng == null) return null;

  const point = { lat, lng };
  if (!requireElSalvador || isLatLngInElSalvador(point)) return point;

  const swapped = { lat: lng, lng: lat };
  return isLatLngInElSalvador(swapped) ? swapped : null;
}

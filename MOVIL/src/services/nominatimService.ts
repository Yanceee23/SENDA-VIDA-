/**
 * Servicio de geocodificación inversa usando Nominatim (OpenStreetMap).
 * Funciona sin backend.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

export type GeoReverseResult = {
  pais?: string;
  pais_codigo?: string;
  region?: string;
  ciudad?: string;
  barrio?: string;
  display_name?: string;
};

export async function reverseGeocode(lat: number, lng: number): Promise<GeoReverseResult | null> {
  try {
    const url = `${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'SendaVidaApp/1.0' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const addr = (data.address as Record<string, string>) ?? {};
    return {
      pais: addr.country ?? undefined,
      pais_codigo: addr.country_code ? String(addr.country_code).toUpperCase() : undefined,
      region: addr.state ?? addr.region ?? undefined,
      ciudad: addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? undefined,
      barrio: addr.suburb ?? addr.neighbourhood ?? undefined,
      display_name: typeof data.display_name === 'string' ? data.display_name : undefined,
    };
  } catch {
    return null;
  }
}

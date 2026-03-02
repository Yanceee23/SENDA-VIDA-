export type GeoPoint = {
  lat: number;
  lon: number;
};

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function haversinePoints(a: GeoPoint, b: GeoPoint): number {
  return haversine(a.lat, a.lon, b.lat, b.lon);
}

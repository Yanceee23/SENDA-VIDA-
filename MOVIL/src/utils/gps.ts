export type LatLng = { lat: number; lng: number };

const RADIO_TIERRA_KM = 6371.0088;

export function distanciaKm(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return RADIO_TIERRA_KM * c;
}

function distanceFactorByType(tipoActividad: string) {
  const t = (tipoActividad ?? '').toLowerCase();
  const factor = t === 'correr' || t === 'running'
    ? 1.05
    : t === 'bicicleta' || t === 'ciclismo' || t === 'cycling'
      ? 0.45
      : t === 'senderismo' || t === 'hiking'
        ? 0.7
        : t === 'caminar' || t === 'walking'
          ? 0.55
          : 0.65;
  return factor;
}

function metBySpeed(tipoActividad: string, speedKmh: number) {
  const t = (tipoActividad ?? '').toLowerCase();
  const speed = Math.max(0, speedKmh);

  if (t === 'bicicleta' || t === 'ciclismo' || t === 'cycling') {
    if (speed < 8) return 4.5;
    if (speed < 14) return 6.8;
    if (speed < 18) return 8.0;
    return 10.0;
  }
  if (t === 'senderismo' || t === 'hiking') {
    if (speed < 3) return 4.5;
    if (speed < 5) return 5.5;
    return 6.8;
  }
  if (t === 'correr' || t === 'running') {
    if (speed < 8) return 8.3;
    if (speed < 10) return 9.8;
    return 11.0;
  }
  if (speed < 3) return 2.8;
  if (speed < 5) return 3.8;
  return 4.8;
}

export function calcularCalorias(
  distanciaKmTotal: number,
  pesoKg: number,
  tipoActividad: string,
  elapsedSec: number = 0
) {
  const factor = distanceFactorByType(tipoActividad);
  const d = Math.max(0, distanciaKmTotal);
  const p = Math.max(1, pesoKg);
  const kcalByDistance = d * p * factor;

  const seg = Math.max(0, Number.isFinite(elapsedSec) ? elapsedSec : 0);
  const hours = seg / 3600;
  if (hours <= 0 || d <= 0) return kcalByDistance;

  const speedKmh = d / Math.max(hours, 1 / 3600);
  const movingEnough = d >= 0.08 || speedKmh >= 1.2;
  if (!movingEnough) return kcalByDistance;

  const met = metBySpeed(tipoActividad, speedKmh);
  const kcalByTime = met * p * hours;
  const blended = kcalByDistance * 0.7 + kcalByTime * 0.3;

  const minSafe = kcalByDistance * 0.75;
  const maxSafe = kcalByDistance * 1.35 + 20;
  return Math.min(maxSafe, Math.max(minSafe, blended));
}

function toRad(v: number) {
  return (v * Math.PI) / 180;
}


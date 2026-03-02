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

export function calcularCalorias(distanciaKmTotal: number, pesoKg: number, tipoActividad: string) {
  const t = (tipoActividad ?? '').toLowerCase();
  const factor =
    t === 'correr' || t === 'running'
      ? 1.05
      : t === 'bicicleta' || t === 'ciclismo' || t === 'cycling'
        ? 0.45
        : t === 'senderismo' || t === 'hiking'
          ? 0.7
          : t === 'caminar' || t === 'walking'
            ? 0.55
            : 0.65;
  const d = Math.max(0, distanciaKmTotal);
  const p = Math.max(1, pesoKg);
  return d * p * factor;
}

function toRad(v: number) {
  return (v * Math.PI) / 180;
}


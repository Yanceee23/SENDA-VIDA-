export function formatHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hh = h > 0 ? `${h.toString().padStart(2, '0')}:` : '';
  return `${hh}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export function formatKm(km: number) {
  if (!Number.isFinite(km)) return '—';
  return `${km.toFixed(2)} km`;
}


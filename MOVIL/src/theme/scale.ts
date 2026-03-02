export function clamp(n: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, n));
}

export function normalizeFontScale(fontScale?: number) {
  if (typeof fontScale !== 'number' || !Number.isFinite(fontScale)) return 1;
  // Evita que se rompa el layout; los valores vienen de Ajustes.
  return clamp(fontScale, 0.85, 1.25);
}

export function scaleFont(size: number, fontScale?: number) {
  return Math.round(size * normalizeFontScale(fontScale));
}


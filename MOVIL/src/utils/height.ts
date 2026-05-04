export const HEIGHT_MIN_M = 0.8;
export const HEIGHT_MAX_M = 2.5;

function normalizeDigits(raw: string) {
  return raw.replace(/\D+/g, '');
}

export function formatHeightMetersInput(raw: string) {
  const digits = normalizeDigits(raw);
  if (!digits) return '';
  const metersWhole = digits.slice(0, Math.max(1, digits.length - 2)).replace(/^0+(?=\d)/, '') || '0';
  const metersDecimal = digits.slice(-2).padStart(2, '0');
  return `${metersWhole}.${metersDecimal}`;
}

export function parseHeightMetersToCm(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number.parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (n < HEIGHT_MIN_M || n > HEIGHT_MAX_M) return null;
  return Math.round(n * 100);
}

export function cmToHeightMetersText(cm: number | null | undefined): string {
  if (cm == null || !Number.isFinite(Number(cm))) return '';
  const meters = Number(cm) / 100;
  if (!Number.isFinite(meters) || meters <= 0) return '';
  return meters.toFixed(2);
}

export function heightMetersError(raw: string): string | undefined {
  if (!raw.trim()) return undefined;
  const parsedCm = parseHeightMetersToCm(raw);
  if (parsedCm == null) return `Altura invalida. Usa formato X.XX entre ${HEIGHT_MIN_M.toFixed(2)} y ${HEIGHT_MAX_M.toFixed(2)} m.`;
  return undefined;
}

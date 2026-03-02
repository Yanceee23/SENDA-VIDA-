export type PerfilCalorias = {
  pesoKg?: number | null;
  alturaCm?: number | null;
  edad?: number | null;
  genero?: string | null;
};

export function calcularCaloriasTMB(opts: {
  perfil: PerfilCalorias;
  tipo: 'ciclismo' | 'senderismo';
  intensidad?: 'suave' | 'intensa';
  distanciaKm: number;
  horas: number;
}): number | null {
  const peso = Number(opts.perfil.pesoKg);
  const altura = Number(opts.perfil.alturaCm);
  const edad = Number(opts.perfil.edad);

  if (!Number.isFinite(peso) || peso <= 0) return null;
  if (!Number.isFinite(altura) || altura <= 0) return null;
  if (!Number.isFinite(edad) || edad <= 0) return null;
  // Fórmula simple (sin género): usa peso + altura + edad + tiempo.
  // Aproximación de TMB diaria (promedio) para no depender de género.
  const tmb = 10 * peso + 6.25 * altura - 5 * edad - 78;

  const actividad = opts.tipo;
  const intensidad = opts.intensidad ?? 'suave';

  const baseFactor = actividad === 'ciclismo' ? 1.55 : 1.375;
  const intensityFactor = intensidad === 'intensa' ? 1.15 : 1;
  const factor = baseFactor * intensityFactor;

  const horas = Math.max(0, opts.horas);
  const total = (tmb / 24) * factor * horas;

  return Number.isFinite(total) ? Math.max(0, total) : null;
}


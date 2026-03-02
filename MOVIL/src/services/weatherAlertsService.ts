import type { ClimaActual } from './climaService';
import { obtenerClimaActual } from './climaService';

export type ExtremeWeatherAlert = {
  shouldAlert: boolean;
  message: string;
  clima: ClimaActual | null;
};

function maxRainProbability(clima: ClimaActual): number {
  const hourly = Array.isArray(clima.probLluviaProximasHoras) ? clima.probLluviaProximasHoras : [];
  return hourly.reduce((acc, item) => Math.max(acc, Number(item?.prob ?? 0)), 0);
}

export async function detectExtremeWeather(baseUrl: string): Promise<ExtremeWeatherAlert> {
  try {
    const clima = await obtenerClimaActual(baseUrl);
    const rainProb = maxRainProbability(clima);
    const hot = Number(clima.temperaturaC) > 35;
    const heavyRain = rainProb > 80;
    if (!hot && !heavyRain) {
      return { shouldAlert: false, message: '', clima };
    }
    const reasons: string[] = [];
    if (hot) reasons.push(`temperatura alta (${Math.round(clima.temperaturaC)}°C)`);
    if (heavyRain) reasons.push(`lluvia probable (${Math.round(rainProb)}%)`);
    return {
      shouldAlert: true,
      message: `Condiciones extremas detectadas: ${reasons.join(' y ')}.`,
      clima,
    };
  } catch {
    return {
      shouldAlert: false,
      message: '',
      clima: null,
    };
  }
}

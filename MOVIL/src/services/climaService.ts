import * as Location from 'expo-location';
import { toQuery } from './api';

export type ClimaActual = {
  temperaturaC: number;
  weathercode: number;
  icono: string;
  condicion: string;
  vientoKmh?: number;
  probLluviaProximasHoras?: { hora: string; prob: number }[];
};

type OpenMeteoResponse = {
  current_weather?: {
    temperature?: number;
    weathercode?: number;
    windspeed?: number;
  };
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
  };
};

type ClimaApiResponse = {
  temperaturaC?: number;
  vientoKmh?: number;
  weathercode?: number;
  icono?: string;
  condicion?: string;
  probLluviaProximasHoras?: { hora: string; prob: number }[];
};

async function fetchClimaFromOpenMeteo(lat: number, lon: number): Promise<ClimaActual> {
  const query = toQuery({
    latitude: lat,
    longitude: lon,
    current_weather: true,
    hourly: 'precipitation_probability',
    timezone: 'auto',
    forecast_days: 1,
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast${query}`);
  if (!response.ok) {
    throw new Error('Sin datos disponibles');
  }

  const raw = (await response.json()) as OpenMeteoResponse;
  const res: ClimaApiResponse = {
    temperaturaC: Number(raw.current_weather?.temperature ?? 0),
    weathercode: Number(raw.current_weather?.weathercode ?? 0),
    vientoKmh: Number(raw.current_weather?.windspeed ?? 0),
    icono: '⛅',
    condicion: 'Sin datos disponibles',
    probLluviaProximasHoras: (Array.isArray(raw.hourly?.time) ? raw.hourly?.time : []).slice(0, 6).map((hora, idx) => ({
      hora: String(hora ?? ''),
      prob: Number((Array.isArray(raw.hourly?.precipitation_probability) ? raw.hourly?.precipitation_probability : [])[idx] ?? 0),
    })),
  };

  const code = Number(res.weathercode ?? 0);
  const icono =
    code === 0 ? '☀️' : code <= 3 ? '⛅' : code <= 48 ? '🌫️' : code <= 67 ? '🌧️' : code <= 77 ? '❄️' : code <= 82 ? '🌦️' : code <= 99 ? '⛈️' : '⛅';
  const condicion =
    code === 0
      ? 'Despejado'
      : code <= 3
        ? 'Parcialmente nublado'
        : code <= 48
          ? 'Neblina'
          : code <= 67
            ? 'Lluvia'
            : code <= 77
              ? 'Nieve'
              : code <= 82
                ? 'Chubascos'
                : code <= 99
                  ? 'Tormenta'
                  : 'Sin datos disponibles';

  return {
    temperaturaC: Number.isFinite(Number(res.temperaturaC)) ? Number(res.temperaturaC) : 0,
    weathercode: Number.isFinite(code) ? code : 0,
    icono,
    condicion,
    vientoKmh: Number.isFinite(Number(res.vientoKmh)) ? Number(res.vientoKmh) : undefined,
    probLluviaProximasHoras: res.probLluviaProximasHoras,
  };
}

/**
 * Obtiene el clima para coordenadas específicas (sin GPS).
 */
export async function obtenerClimaPorCoords(lat: number, lon: number): Promise<ClimaActual> {
  return fetchClimaFromOpenMeteo(lat, lon);
}

/**
 * Obtiene el clima actual directo desde Open-Meteo.
 * Requiere ubicación para lat/lng.
 */
export async function obtenerClimaActual(_apiBaseUrl?: string): Promise<ClimaActual> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error('Activa el permiso de ubicación para ver el clima actual.');
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return fetchClimaFromOpenMeteo(pos.coords.latitude, pos.coords.longitude);
}

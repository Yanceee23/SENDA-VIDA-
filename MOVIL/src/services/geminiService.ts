/**
 * SERVICIO GEMINI - REGLA ABSOLUTA DE USO:
 * Solo llamar cuando el usuario toque explícitamente el botón del robot.
 * NUNCA en useEffect, NUNCA al cargar pantalla, NUNCA automáticamente.
 * Un toque = una llamada = un token.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GEMINI_API_BASE_URL, GEMINI_API_KEY, GEMINI_MODELS, STORAGE_KEYS } from '../config';

const GEMINI_TIMEOUT_MS = 30000;
const NETWORK_ERROR_MESSAGE = 'No pude conectarme. Verifica tu internet.';
const CONFIG_ERROR_MESSAGE = 'Error de configuración del asistente.';
export const RATE_LIMIT_MESSAGE = 'Asistente ocupado, intenta en unos minutos 🤖';

type GeminiPart = {
  text?: string;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
};

type GeminiErrorPayload = {
  code?: number;
  status?: string;
  message?: string;
};

type GeminiGenerateResponse = {
  candidates?: GeminiCandidate[];
  error?: GeminiErrorPayload;
};

type GeminiRequestBody = {
  contents: Array<{
    parts: Array<
      | { text: string }
      | {
          inline_data: {
            mime_type: string;
            data: string;
          };
        }
    >;
  }>;
};

type RouteAdviceInput = {
  kmHoy: number;
  caloriasHoy: number;
  rutasMes: number;
  kmMes: number;
  clima: string;
  temperatura: number | null;
  hora: number;
  actividad?: 'caminata' | 'bici' | string;
  destino?: string;
  tiempoSegundos?: number;
  nombreUsuario?: string;
};

export type LivingThingIdentification = {
  categoria: 'animal' | 'planta' | 'hongo' | 'insecto' | 'desconocido';
  nombreComun: string;
  tipoEspecifico: string;
  nombreCientifico: string;
  distribucion: string;
  habitat: string;
  peligrosidad: string;
  confianza: number;
  posiblesCoincidencias: string[];
  fuenteSugerida: string;
  recomendacionUsuario: string;
  rawText: string;
};

function parseGeminiResponse(raw: unknown): GeminiGenerateResponse {
  if (!raw || typeof raw !== 'object') return {};
  return raw as GeminiGenerateResponse;
}

function extractText(raw: unknown): string | null {
  const data = parseGeminiResponse(raw);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') return null;
  const normalized = text.trim();
  return normalized.length > 0 ? normalized : null;
}

function isConfigError(status: number, message: string): boolean {
  if (status === 401 || status === 403) return true;
  const m = message.toLowerCase();
  return (
    m.includes('api key') ||
    m.includes('apikey') ||
    m.includes('permission denied') ||
    m.includes('unauthenticated') ||
    m.includes('invalid key') ||
    m.includes('forbidden')
  );
}

function isNetworkError(status: number, message: string): boolean {
  if (status === 0) return true;
  const m = message.toLowerCase();
  return (
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('tiempo de espera agotado') ||
    m.includes('aborted') ||
    m.includes('abort')
  );
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildGeminiUrl(model: string): string {
  return `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

function isModelNotFound(status: number, message: string): boolean {
  if (status !== 404) return false;
  const m = message.toLowerCase();
  return m.includes('not found') || m.includes('is not supported');
}

function isRateLimitError(status: number): boolean {
  return status === 429;
}

async function callGeminiOnce(model: string, body: GeminiRequestBody): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(buildGeminiUrl(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Una sola llamada a la API por acción del usuario (un token por toque del robot). */
async function callGemini(body: GeminiRequestBody, fallbackMessage: string): Promise<string> {
  const model = GEMINI_MODELS[0];
  try {
    const res = await callGeminiOnce(model, body);
    const parsed = await parseJsonSafe(res);

    if (!res.ok) {
      const maybeObj = parsed && typeof parsed === 'object' ? (parsed as GeminiGenerateResponse) : null;
      const errMessage =
        maybeObj?.error?.message ??
        (typeof parsed === 'string' ? parsed : `Error HTTP ${res.status}`);

      if (isConfigError(res.status, errMessage)) throw new Error(CONFIG_ERROR_MESSAGE);
      if (isNetworkError(res.status, errMessage)) throw new Error(NETWORK_ERROR_MESSAGE);
      if (isRateLimitError(res.status)) throw new Error(RATE_LIMIT_MESSAGE);
      throw new Error(fallbackMessage);
    }

    const text = extractText(parsed);
    return text ?? fallbackMessage;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (message === CONFIG_ERROR_MESSAGE) throw error;
    if (message === RATE_LIMIT_MESSAGE) throw error;
    if (message === fallbackMessage) throw error;
    if (isNetworkError(0, message)) throw new Error(NETWORK_ERROR_MESSAGE);
    throw new Error(fallbackMessage);
  }
}

export async function requestRouteAdvice(input: RouteAdviceInput): Promise<string> {
  const actividad = input.actividad ?? 'actividad';
  const tiempoMin = input.tiempoSegundos != null ? Math.round(input.tiempoSegundos / 60) : Math.round((input.kmHoy * 15) || 0);
  const destoTxt = input.destino ? ` Destino: ${input.destino}.` : '';
  const nombreTxt = input.nombreUsuario ? ` Para ${input.nombreUsuario}.` : '';
  const prompt = `Eres coach deportivo.${nombreTxt} Responde en formato: "Hoy corriste/hiciste X km, quemaste X calorías, con clima X (temperatura). Te recomiendo: [2-3 consejos breves en español]."
Datos: ${input.kmHoy.toFixed(1)} km hoy, ${Math.round(input.caloriasHoy)} cal, ${input.kmMes} km este mes, ${input.rutasMes} rutas, ${tiempoMin} min de ${actividad}. Clima: ${input.clima}${input.temperatura != null ? ` ${input.temperatura}°C` : ''}.${destoTxt}`;

  const fallbackMessage = 'No pude conectarme. Verifica tu internet e intenta de nuevo.';
  const result = await callGemini(
    {
      contents: [{ parts: [{ text: prompt }] }],
    },
    fallbackMessage
  );
  if (result && result !== fallbackMessage && result.trim().length > 0) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.lastRouteAdvice, result);
    } catch {
      // Ignorar si falla el guardado
    }
  }
  return result;
}

function safeString(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : fallback;
}

function safeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function extractJsonCandidate(text: string): string | null {
  const codeBlocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const block of codeBlocks) {
    const candidate = String(block[1] ?? '').trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate;
  }
  const firstObj = text.match(/\{[\s\S]*\}/);
  const candidate = firstObj?.[0]?.trim();
  if (candidate && candidate.startsWith('{') && candidate.endsWith('}')) return candidate;
  return null;
}

function normalizeCategoria(raw: unknown): LivingThingIdentification['categoria'] {
  const value = safeString(raw, '').toLowerCase();
  if (value === 'animal' || value === 'planta' || value === 'hongo' || value === 'insecto') return value;
  return 'desconocido';
}

function normalizeIdentification(raw: unknown, rawText: string): LivingThingIdentification | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const posibles = Array.isArray(data.posiblesCoincidencias)
    ? data.posiblesCoincidencias
        .map((v) => safeString(v, ''))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const nombreComun = safeString(data.nombre ?? data.nombreComun, 'Sin identificar');
  const tipoStr = safeString(data.tipo ?? data.categoria ?? data.tipoEspecifico, '');
  const categoria = normalizeCategoria((data.categoria ?? data.tipo ?? tipoStr) || null);
  return {
    categoria,
    nombreComun,
    tipoEspecifico: safeString(data.tipoEspecifico ?? data.tipo ?? data.descripcion, 'No disponible'),
    nombreCientifico: safeString(data.nombreCientifico, 'No disponible'),
    distribucion: safeString(data.distribucion, 'No disponible'),
    habitat: safeString(data.habitat, 'No disponible'),
    peligrosidad: safeString(data.peligrosidad, 'No disponible'),
    confianza: Math.max(0, Math.min(100, safeNumber(data.confianza, 40))),
    posiblesCoincidencias: posibles,
    fuenteSugerida: safeString(data.fuenteSugerida, 'GBIF / iNaturalist'),
    recomendacionUsuario: safeString(data.recomendacionUsuario ?? data.datoCurioso, 'Observa sin manipular.'),
    rawText,
  };
}

function fallbackIdentificationFromText(rawText: string): LivingThingIdentification {
  const lower = rawText.toLowerCase();
  const categoria: LivingThingIdentification['categoria'] = lower.includes('planta')
    ? 'planta'
    : lower.includes('animal')
      ? 'animal'
      : lower.includes('hongo')
        ? 'hongo'
        : lower.includes('insecto')
          ? 'insecto'
          : 'desconocido';
  return {
    categoria,
    nombreComun: 'Sin identificar',
    tipoEspecifico: 'No disponible',
    nombreCientifico: 'No disponible',
    distribucion: 'No disponible',
    habitat: 'No disponible',
    peligrosidad: 'No disponible',
    confianza: 35,
    posiblesCoincidencias: [],
    fuenteSugerida: 'GBIF / iNaturalist',
    recomendacionUsuario: 'No se pudo confirmar la especie con precisión. Intenta con otra foto más cercana y bien iluminada.',
    rawText,
  };
}

export async function identifyLivingThingFromImage(params: {
  base64: string;
  mimeType: string;
}): Promise<LivingThingIdentification> {
  const prompt =
    'Identifica este ser vivo en español. Responde SOLO con JSON: {nombre (nombre común), nombreCientifico, tipo: "planta"|"animal"|"hongo"|"insecto", descripcion (breve y clara), datoCurioso}. Incluye siempre nombre común, nombre científico, tipo, descripción y un dato curioso.';

  const response = await callGemini(
    {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: params.mimeType || 'image/jpeg',
                data: params.base64,
              },
            },
          ],
        },
      ],
    },
    'No pude identificar. Verifica tu conexión e intenta de nuevo.'
  );

  const jsonCandidate = extractJsonCandidate(response);
  if (!jsonCandidate) return fallbackIdentificationFromText(response);
  try {
    const parsed = JSON.parse(jsonCandidate);
    return normalizeIdentification(parsed, response) ?? fallbackIdentificationFromText(response);
  } catch {
    return fallbackIdentificationFromText(response);
  }
}

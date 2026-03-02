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
};

export type LivingThingIdentification = {
  categoria: 'animal' | 'planta' | 'desconocido';
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

async function callGemini(body: GeminiRequestBody, fallbackMessage: string): Promise<string> {
  for (const model of GEMINI_MODELS) {
    for (let retry = 0; retry <= 1; retry++) {
      try {
        const res = await callGeminiOnce(model, body);
        const parsed = await parseJsonSafe(res);

        if (!res.ok) {
          const maybeObj = parsed && typeof parsed === 'object' ? (parsed as GeminiGenerateResponse) : null;
          const errMessage =
            maybeObj?.error?.message ??
            (typeof parsed === 'string' ? parsed : `Error HTTP ${res.status}`);

          console.error('[Gemini] HTTP error', { model, status: res.status, parsed, requestBody: body });

          if (isConfigError(res.status, errMessage)) {
            throw new Error(CONFIG_ERROR_MESSAGE);
          }
          if (isNetworkError(res.status, errMessage)) {
            throw new Error(NETWORK_ERROR_MESSAGE);
          }
          if (isModelNotFound(res.status, errMessage)) {
            break;
          }
          if (isRateLimitError(res.status)) {
            throw new Error('Asistente ocupado, intenta en unos minutos 🤖');
          }
          throw new Error(fallbackMessage);
        }

        const text = extractText(parsed);
        return text ?? fallbackMessage;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error ?? '');
        console.error('[Gemini] Exception in callGemini', { model, error, requestBody: body });

        if (message === CONFIG_ERROR_MESSAGE) throw error;
        if (message === RATE_LIMIT_MESSAGE) throw error;
        if (isNetworkError(0, message)) {
          throw new Error(NETWORK_ERROR_MESSAGE);
        }
        if (message === fallbackMessage) {
          throw error;
        }
        break;
      }
    }
  }

  throw new Error(fallbackMessage);
}

export async function requestRouteAdvice(input: RouteAdviceInput): Promise<string> {
  const temp = input.temperatura == null ? 'sin dato' : `${Math.round(input.temperatura)}°C`;
  const horario =
    input.hora >= 5 && input.hora <= 10 ? 'mañana' : input.hora >= 11 && input.hora <= 16 ? 'mediodía/tarde' : 'noche/madrugada';
  const riesgoCalor =
    input.temperatura == null
      ? 'desconocido'
      : input.temperatura >= 36
        ? 'extremo'
        : input.temperatura >= 32
          ? 'alto'
          : input.temperatura >= 28
            ? 'moderado'
            : 'bajo';
  const prompt = [
    'Eres un entrenador y guía de rutas urbanas y naturales.',
    'Con base en los datos del usuario, recomienda UNA ruta y ritmo seguro.',
    'Contexto actual:',
    `- clima: ${input.clima}`,
    `- temperatura: ${temp}`,
    `- franja horaria: ${horario}`,
    `- km hoy: ${input.kmHoy.toFixed(2)}`,
    `- calorías hoy: ${Math.round(input.caloriasHoy)}`,
    `- rutas este mes: ${Math.round(input.rutasMes)}`,
    `- km este mes: ${input.kmMes.toFixed(2)}`,
    `- riesgo de calor estimado: ${riesgoCalor}`,
    '',
    'Responde SOLO en 5 líneas, en español y directo:',
    '1) Tiempo recomendado: <minutos sugeridos>',
    '2) Ruta recomendada: <tipo de ruta y distancia>',
    '3) Intensidad: <baja/media/alta + por qué>',
    '4) Riesgo climático: <riesgo actual y precaución>',
    '5) Acción sugerida: <continuar / acortar / pausar e hidratar>',
  ].join('\n');

  const fallbackMessage = 'Servicio temporalmente no disponible, intenta más tarde.';
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
  if (value === 'animal' || value === 'planta') return value;
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
  return {
    categoria: normalizeCategoria(data.categoria),
    nombreComun: safeString(data.nombreComun, 'Sin identificar'),
    tipoEspecifico: safeString(data.tipoEspecifico, 'No disponible'),
    nombreCientifico: safeString(data.nombreCientifico, 'No disponible'),
    distribucion: safeString(data.distribucion, 'No disponible'),
    habitat: safeString(data.habitat, 'No disponible'),
    peligrosidad: safeString(data.peligrosidad, 'No disponible'),
    confianza: Math.max(0, Math.min(100, safeNumber(data.confianza, 40))),
    posiblesCoincidencias: posibles,
    fuenteSugerida: safeString(data.fuenteSugerida, 'GBIF / Catálogo taxonómico local'),
    recomendacionUsuario: safeString(data.recomendacionUsuario, 'Observa sin manipular y valida la especie con una fuente confiable.'),
    rawText,
  };
}

function fallbackIdentificationFromText(rawText: string): LivingThingIdentification {
  const lower = rawText.toLowerCase();
  const categoria: LivingThingIdentification['categoria'] = lower.includes('planta')
    ? 'planta'
    : lower.includes('animal')
      ? 'animal'
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
  const prompt = [
    'Analiza la imagen e identifica si es animal o planta.',
    'Debes responder SOLO en JSON válido, sin texto adicional.',
    'Campos obligatorios:',
    '{',
    '  "categoria": "animal|planta|desconocido",',
    '  "nombreComun": "texto",',
    '  "tipoEspecifico": "raza o especie probable",',
    '  "nombreCientifico": "texto",',
    '  "distribucion": "dónde se encuentra (países/región/continente)",',
    '  "habitat": "hábitat típico",',
    '  "peligrosidad": "ninguna|baja|media|alta + breve motivo",',
    '  "confianza": 0-100,',
    '  "posiblesCoincidencias": ["opción1","opción2"],',
    '  "fuenteSugerida": "GBIF, iNaturalist u otra base confiable",',
    '  "recomendacionUsuario": "acción breve y segura para el usuario"',
    '}',
    'Si no estás seguro, marca "desconocido" y baja confianza.',
    'Responde en español.',
  ].join('\n');

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
    'No se pudo identificar.'
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

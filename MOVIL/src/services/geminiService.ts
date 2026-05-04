// Gemini se usa desde el botón del asistente; no hagas fetch en montaje ni useEffect.
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
  generationConfig?: Record<string, unknown>;
};

const IDENTIFY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    nombreComun: { type: 'string', description: 'Nombre común en español.' },
    nombreCientifico: {
      type: 'string',
      description: 'Nombre binomial o género/especie; si no es seguro, decirlo explícitamente.',
    },
    tipo: {
      type: 'string',
      description: 'Solo una palabra: planta, animal, hongo o insecto.',
    },
    tipoPlanta_o_grupo: {
      type: 'string',
      description:
        'Grupo fino: p. ej. arbusto trepador, suculenta, hierba, árbol, pez, ave. Nunca solo repetir "planta" o "animal".',
    },
    descripcion: {
      type: 'string',
      description: '2–4 frases sobre forma, hojas, flores, color, contexto de la foto. No una sola palabra genérica.',
    },
    habitat: {
      type: 'string',
      description: 'Medio típico: clima, suelo, jardín, maceta, bosque seco tropical, etc.',
    },
    distribucion: { type: 'string', description: 'Región biogeográfica o países de origen habitual.' },
    peligrosidad: { type: 'string', description: 'Seguridad o ausencia de riesgos conocidos.' },
    datoCurioso: { type: 'string', description: 'Un solo dato interesante y verificable.' },
  },
  required: [
    'nombreComun',
    'nombreCientifico',
    'tipo',
    'tipoPlanta_o_grupo',
    'descripcion',
    'habitat',
    'distribucion',
    'peligrosidad',
    'datoCurioso',
  ],
};

function identificationGenerationConfig(): Record<string, unknown> {
  return {
    temperature: 0.25,
    responseMimeType: 'application/json',
    responseSchema: IDENTIFY_JSON_SCHEMA,
  };
}

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
  descripcion: string;
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
  if (!GEMINI_API_KEY) throw new Error(CONFIG_ERROR_MESSAGE);
  const url = new URL(`${GEMINI_API_BASE_URL}/models/${model}:generateContent`);
  url.searchParams.set('key', GEMINI_API_KEY);
  return url.toString();
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
  console.log('🔑 Gemini API:', GEMINI_API_KEY ? 'clave configurada' : 'vacía (.env)');
  console.log('🤖 MODEL:', model);
  const url = buildGeminiUrl(model);
  console.log('🌐 URL:', `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=***`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    console.log('📡 STATUS:', res.status);
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Va probando modelos en orden; con structured intenta primero con JSON/schema y si falla, sin eso.
async function callGemini(
  body: GeminiRequestBody,
  fallbackMessage: string,
  structured?: { generationConfig: Record<string, unknown> }
): Promise<string> {
  const { generationConfig: _omit, ...base } = body;
  const bodyVariants: GeminiRequestBody[] = structured
    ? [{ ...base, generationConfig: structured.generationConfig }, base]
    : [base];

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    const isLastModel = i === GEMINI_MODELS.length - 1;
    for (const fullBody of bodyVariants) {
      try {
        const res = await callGeminiOnce(model, fullBody);
        const parsed = await parseJsonSafe(res);

        if (!res.ok) {
          const maybeObj = parsed && typeof parsed === 'object' ? (parsed as GeminiGenerateResponse) : null;
          const errMessage =
            maybeObj?.error?.message ??
            (typeof parsed === 'string' ? parsed : `Error HTTP ${res.status}`);

          console.log('❌ ERROR:', res.status, errMessage);

          if (isConfigError(res.status, errMessage)) throw new Error(CONFIG_ERROR_MESSAGE);
          if (isNetworkError(res.status, errMessage)) throw new Error(NETWORK_ERROR_MESSAGE);
          if (isRateLimitError(res.status) && !isLastModel) break;
          if (isRateLimitError(res.status)) throw new Error(RATE_LIMIT_MESSAGE);
          if (isModelNotFound(res.status, errMessage) && !isLastModel) break;
          // A veces 400 si ese modelo no acepta el body con schema; probamos sin generationConfig.
          if (res.status === 400 && fullBody.generationConfig && bodyVariants.length > 1) continue;
          if (!isLastModel) break;
          throw new Error(fallbackMessage);
        }

        const text = extractText(parsed);
        if (text) return text;
        if (fullBody.generationConfig && bodyVariants.length > 1) continue;
        if (!isLastModel) break;
        return fallbackMessage;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error ?? '');
        console.log('💥 CATCH:', message);
        if (message === CONFIG_ERROR_MESSAGE) throw error;
        if (message === NETWORK_ERROR_MESSAGE) throw error;
        if (message === RATE_LIMIT_MESSAGE && isLastModel) throw error;
        if (message === RATE_LIMIT_MESSAGE && !isLastModel) break;
        if (isNetworkError(0, message)) throw new Error(NETWORK_ERROR_MESSAGE);
        if (!isLastModel) break;
        throw new Error(fallbackMessage);
      }
    }
  }
  throw new Error(fallbackMessage);
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
      // no pasa nada si no se puede guardar
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

function isGenericCategoriaToken(s: string): boolean {
  const x = s.trim().toLowerCase();
  return x === 'planta' || x === 'animal' || x === 'hongo' || x === 'insecto' || x === 'desconocido';
}

function pickHabitat(data: Record<string, unknown>): string {
  return safeString(
    data.habitat ?? data.medio_ambiente ?? data.ecosistema ?? data.donde_vive,
    ''
  );
}

function pickTipoEspecifico(data: Record<string, unknown>): string {
  const fromModel = safeString(
    data.tipoEspecifico ??
      data.tipo_especifico ??
      data.tipoPlanta_o_grupo ??
      data.tipoPlanta ??
      data.tipo_planta ??
      data.clasificacionPlanta ??
      data.grupo_taxonomico ??
      data.grupoTaxonomico ??
      data.grupo ??
      data.familia ??
      data.clase_taxonomica ??
      data.caracterTipo,
    ''
  );
  if (fromModel && !isGenericCategoriaToken(fromModel)) return fromModel;
  const tipoRaw = safeString(data.tipo, '');
  if (tipoRaw && !isGenericCategoriaToken(tipoRaw)) return tipoRaw;
  return 'No disponible';
}

function pickDescripcion(data: Record<string, unknown>): string {
  const d = safeString(
    data.descripcion ?? data.description ?? data.texto_descripcion ?? data.caracteristicas ?? data.detalle,
    ''
  );
  const lower = d.toLowerCase().trim();
  if (lower === 'planta' || lower === 'animal' || lower === 'hongo' || lower === 'insecto') return '';
  return d.length > 0 ? d : 'No disponible';
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
  const descripcion = pickDescripcion(data);
  const habitatRaw = pickHabitat(data);
  let tipoEspecifico = pickTipoEspecifico(data);
  // Si el JSON trae texto útil pero el tipo viene vacío, evitamos dejar solo "planta/animal".
  if (
    tipoEspecifico === 'No disponible' &&
    descripcion !== 'No disponible' &&
    data.tipoEspecifico == null &&
    data.tipoPlanta_o_grupo == null &&
    data.tipo_planta == null &&
    data.tipoPlanta == null
  ) {
    tipoEspecifico = '(Clasificación pendiente — ver descripción)';
  }

  return {
    categoria,
    nombreComun,
    tipoEspecifico,
    descripcion,
    nombreCientifico: safeString(data.nombreCientifico, 'No disponible'),
    distribucion: safeString(data.distribucion ?? data.distribución, 'No disponible'),
    habitat: habitatRaw.length > 0 ? habitatRaw : 'No disponible',
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
  const cleanText = rawText.replace(/\s+/g, ' ').trim();
  const usableDescription = cleanText.length > 0 && cleanText.length < 500 ? cleanText : '';
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
    descripcion: usableDescription || 'No se pudo obtener una descripción confiable. Intenta otra foto con mejor luz y el organismo centrado.',
    nombreCientifico: 'No disponible',
    distribucion: 'No determinada desde la foto.',
    habitat: 'No disponible',
    peligrosidad: 'No disponible',
    confianza: 35,
    posiblesCoincidencias: [],
    fuenteSugerida: 'GBIF / iNaturalist',
    recomendacionUsuario: 'No se pudo confirmar la especie con precisión. Intenta con otra foto más cercana y bien iluminada.',
    rawText,
  };
}

function normalizeImageBase64(raw: string): string {
  const value = String(raw ?? '').trim();
  const commaIdx = value.indexOf(',');
  if (value.startsWith('data:') && commaIdx >= 0) {
    return value.slice(commaIdx + 1).trim();
  }
  return value;
}

function normalizeImageMimeType(raw: string): string {
  const mime = String(raw ?? '').trim().toLowerCase();
  if (mime === 'image/jpg') return 'image/jpeg';
  return mime.startsWith('image/') ? mime : 'image/jpeg';
}

export async function identifyLivingThingFromImage(params: {
  base64: string;
  mimeType: string;
}): Promise<LivingThingIdentification> {
  if (!GEMINI_API_KEY) throw new Error(CONFIG_ERROR_MESSAGE);
  const imageBase64 = normalizeImageBase64(params.base64);
  const imageMimeType = normalizeImageMimeType(params.mimeType);
  if (!imageBase64) throw new Error('No se pudo leer la imagen para identificarla.');

  const prompt = `Observa esta imagen. Identifica el ser vivo principal en español.
Responde ÚNICAMENTE con un objeto JSON válido (sin texto ni markdown antes o después).
Claves obligatorias y significado:
- "nombreComun": nombre común conocido en español (si no está claro: la mejor etiqueta observable).
- "nombreCientifico": género especie en cursiva opcional omitida; formato "Nombre especie" cuando sea posible, o cadena honesta tipo "Sin determinar desde la foto".
- "tipo": uno de solo estas palabras: "planta" | "animal" | "hongo" | "insecto" (categoría general).
- "tipoPlanta_o_grupo": SOLO si tipo es planta u hongo parecido: tipo fino fuera de esa palabra única — ej. suculenta, hierba ornamental, monocotiledónea, árbol, arbusto; para animales grupo similar (pez, ave, mamífero…). SIEMPRE rellénalo cuando sea planta/animal/insecto. Nunca escribas solo "planta" aquí.
- "descripcion": 2–4 frases observables sobre forma, color, hábitos, hojas, flores si se ven — no debe ser solo la categoría ni una sola palabra genérica como "planta".
- "habitat": medio natural habitual (selva tropical seca, jardín, maceta interior, zonas áridas, etc.). Sé concreto. Si parece ornamental en maceta díalo.
- "distribucion": región donde habita típicamente (clima / países o "América tropical", etc.).
- "peligrosidad": p. ej. "ninguna conocida si no se consume", pinchos como en aloe vera, irritación de jugo si aplica — o "no determinada".
- "datoCurioso": una frase divertida y verificable relacionada al taxón inferido.

Ejemplo válido conceptual (solo estructura, no inventes estos datos desde la foto):
{"nombreComun":"...","nombreCientifico":"...","tipo":"planta","tipoPlanta_o_grupo":"suculenta herbácea perenne","descripcion":"...","habitat":"...","distribucion":"...","peligrosidad":"...","datoCurioso":"..."}`;

  const response = await callGemini(
    {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: imageMimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
    },
    'No pude identificar. Verifica tu conexión e intenta de nuevo.',
    { generationConfig: identificationGenerationConfig() }
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

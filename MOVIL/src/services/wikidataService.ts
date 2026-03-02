import { apiRequest, type ApiError } from './api';

type SearchEntity = {
  id: string;
  label?: string;
  description?: string;
};

type SearchResponse = {
  search?: SearchEntity[];
};

type WikidataText = {
  value?: string;
};

type WikidataSnakDataValue = {
  value?: unknown;
};

type WikidataClaimSnak = {
  datavalue?: WikidataSnakDataValue;
};

type WikidataClaim = {
  mainsnak?: WikidataClaimSnak;
};

type WikidataEntity = {
  id?: string;
  labels?: Record<string, WikidataText>;
  descriptions?: Record<string, WikidataText>;
  claims?: Record<string, WikidataClaim[]>;
};

type GetEntitiesResponse = {
  entities?: Record<string, WikidataEntity>;
};

type EntityDetails = {
  label: string;
  description: string;
  elevationM: number | null;
  imageUrl: string | null;
};

const WIKIDATA_BASE_URL = 'https://www.wikidata.org';

function isApiError(error: unknown): error is ApiError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof (error as { status?: unknown }).status === 'number'
  );
}

function buildWikidataApiPath(params: Record<string, string | number>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  // Obligatorio para CORS en clientes web/móviles híbridos.
  search.set('origin', '*');
  return `/w/api.php?${search.toString()}`;
}

function firstClaimValue(entity: WikidataEntity, prop: string): unknown {
  const claim = entity.claims?.[prop]?.[0];
  return claim?.mainsnak?.datavalue?.value;
}

function parseElevationMeters(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const amount = (raw as { amount?: unknown }).amount;
  if (typeof amount !== 'string') return null;
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(raw)}`;
}

function parseEntityDetails(entity: WikidataEntity, fallbackLabel: string): EntityDetails {
  const label = String(entity.labels?.es?.value ?? fallbackLabel).trim() || fallbackLabel;
  const description = String(entity.descriptions?.es?.value ?? 'Sin datos disponibles').trim() || 'Sin datos disponibles';
  const elevationM = parseElevationMeters(firstClaimValue(entity, 'P2044'));
  const imageUrl = parseImageUrl(firstClaimValue(entity, 'P18'));
  return {
    label,
    description,
    elevationM,
    imageUrl,
  };
}

export type WikidataInfo = {
  qid: string | null;
  label: string;
  description: string;
  elevationM: number | null;
  imageUrl: string | null;
  fallbackOnly: boolean;
};

async function searchEntityByName(name: string): Promise<SearchEntity | null> {
  const path = buildWikidataApiPath({
    action: 'wbsearchentities',
    search: name,
    language: 'es',
    format: 'json',
    limit: 1,
  });
  const res = await apiRequest<SearchResponse>(WIKIDATA_BASE_URL, path, { method: 'GET', timeoutMs: 20000 });
  const first = Array.isArray(res.search) ? res.search[0] : undefined;
  return first ?? null;
}

async function fetchEntityByQid(qid: string, fallbackLabel: string): Promise<WikidataInfo> {
  const path = buildWikidataApiPath({
    action: 'wbgetentities',
    ids: qid,
    languages: 'es',
    format: 'json',
  });
  const res = await apiRequest<GetEntitiesResponse>(WIKIDATA_BASE_URL, path, { method: 'GET', timeoutMs: 20000 });
  const entity = res.entities?.[qid];
  if (!entity) {
    throw new Error('Sin datos disponibles');
  }
  const details = parseEntityDetails(entity, fallbackLabel);
  return {
    qid,
    label: details.label,
    description: details.description,
    elevationM: details.elevationM,
    imageUrl: details.imageUrl,
    fallbackOnly: false,
  };
}

export async function getWikidataInfoByPlaceName(placeName: string): Promise<WikidataInfo> {
  const fallback = {
    qid: null,
    label: placeName,
    description: 'Sin datos disponibles',
    elevationM: null,
    imageUrl: null,
    fallbackOnly: true,
  } as const;

  try {
    const searched = await searchEntityByName(placeName);
    if (!searched?.id) {
      return { ...fallback };
    }

    try {
      return await fetchEntityByQid(searched.id, String(searched.label ?? placeName));
    } catch (error) {
      // Si Wikidata responde 403 u otro error, regresamos fallback sin romper la UI.
      if (isApiError(error) && error.status === 403) {
        return {
          qid: searched.id,
          label: String(searched.label ?? placeName),
          description: 'Sin datos disponibles',
          elevationM: null,
          imageUrl: null,
          fallbackOnly: true,
        };
      }
      return {
        qid: searched.id,
        label: String(searched.label ?? placeName),
        description: String(searched.description ?? 'Sin datos disponibles'),
        elevationM: null,
        imageUrl: null,
        fallbackOnly: true,
      };
    }
  } catch {
    return {
      ...fallback,
    };
  }
}

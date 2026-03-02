import { STORAGE_KEYS } from '../config';
import { getJson, setJson } from './storage';

export type OfflineRoutePack = {
  id: number;
  nombre: string;
  tipo: string;
  gpsInicio?: any;
  gpsFin?: any;
  downloadedAt: string;
};

type OfflineRoutesState = {
  ids: number[];
  packsById: Record<string, OfflineRoutePack>;
};

const defaultState: OfflineRoutesState = { ids: [], packsById: {} };

export async function getOfflineRoutesState(): Promise<OfflineRoutesState> {
  const stored = await getJson<OfflineRoutesState>(STORAGE_KEYS.offlineRoutes);
  if (!stored || !Array.isArray(stored.ids) || typeof stored.packsById !== 'object' || stored.packsById == null) {
    return defaultState;
  }
  return { ids: stored.ids.map((x) => Number(x)).filter((x) => Number.isFinite(x)), packsById: stored.packsById };
}

export async function isRouteDownloaded(id: number): Promise<boolean> {
  const st = await getOfflineRoutesState();
  return st.ids.includes(Number(id));
}

export async function toggleOfflineRoute(pack: OfflineRoutePack): Promise<{ downloaded: boolean; state: OfflineRoutesState }> {
  const st = await getOfflineRoutesState();
  const id = Number(pack.id);
  const has = st.ids.includes(id);
  const next: OfflineRoutesState = has
    ? {
        ids: st.ids.filter((x) => x !== id),
        packsById: Object.fromEntries(Object.entries(st.packsById).filter(([k]) => Number(k) !== id)),
      }
    : {
        ids: [...st.ids, id],
        packsById: { ...st.packsById, [String(id)]: pack },
      };

  await setJson(STORAGE_KEYS.offlineRoutes, next);
  return { downloaded: !has, state: next };
}


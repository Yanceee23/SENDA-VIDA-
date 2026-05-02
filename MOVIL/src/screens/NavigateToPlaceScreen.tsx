import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useRoute } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { LargeButton } from '../components/LargeButton';
import { LiveMap } from '../components/LiveMap';
import { apiRequest, toQuery } from '../services/api';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { normalizeLatLng } from '../utils/coordinates';

type LatLng = { lat: number; lng: number };

type SearchResult = {
  display_name?: string;
  lat?: string | number;
  lng?: string | number;
  type?: string;
  class?: string;
  importance?: number;
};

type LugarBuscado = {
  nombre: string;
  lat: number;
  lon: number;
};

type RouteRes = {
  distance_m?: number;
  duration_s?: number;
  geometry?: { lat: number; lng: number }[];
  error?: string;
};

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resultKey(item: SearchResult | null): string {
  if (!item) return '';
  const lat = toNum(item.lat);
  const lng = toNum(item.lng);
  const name = String(item.display_name ?? '').trim();
  return `${name}:${lat ?? 'x'}:${lng ?? 'x'}`;
}

export function NavigateToPlaceScreen() {
  const { settings } = useSettings();
  const route = useRoute<any>();
  const params = (route?.params ?? {}) as { destLat?: number; destLng?: number; destNombre?: string };

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [selectedKey, setSelectedKey] = useState('');

  const [gpsOk, setGpsOk] = useState(false);
  const [me, setMe] = useState<LatLng | null>(null);
  const [routing, setRouting] = useState(false);
  const [profile, setProfile] = useState<'walking' | 'cycling'>('walking');
  const [routePoints, setRoutePoints] = useState<LatLng[]>([]);
  const [routeMeta, setRouteMeta] = useState<{ distanceM?: number; durationS?: number } | null>(null);

  const dest = useMemo(() => {
    if (!selected) return null;
    return normalizeLatLng({ lat: selected.lat, lng: selected.lng });
  }, [selected]);

  useEffect(() => {
    const point = normalizeLatLng({ lat: params.destLat, lng: params.destLng });
    if (!point) return;

    const name = String(params.destNombre ?? 'Destino');
    const next = { display_name: name, lat: point.lat, lng: point.lng };
    setSelected(next);
    setSelectedKey(resultKey(next));
    setQuery(name);
    setResults([]);
    setRoutePoints([]);
    setRouteMeta(null);
  }, [params.destLat, params.destLng, params.destNombre]);

  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          setGpsOk(false);
          setMe(null);
          return;
        }
        setGpsOk(true);
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setGpsOk(false);
        setMe(null);
      }
    })();
  }, []);

  const region = useMemo(() => {
    const base = me ?? dest;
    if (!base) return undefined;
    return { latitude: base.lat, longitude: base.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
  }, [me, dest]);

  const onSearch = async () => {
    const q = query.trim();
    if (!q) return;
    try {
      setSearching(true);
      setSelected(null);
      setSelectedKey('');
      setRoutePoints([]);
      setRouteMeta(null);
      const lugares = await buscarLugar(q);
      const mapped: SearchResult[] = lugares.map((item) => ({
        display_name: item.nombre,
        lat: String(item.lat),
        lng: String(item.lon),
      }));
      setResults(mapped);
    } catch (error: unknown) {
      Alert.alert('Buscar', error instanceof Error ? error.message : 'No se pudo buscar el destino.');
    } finally {
      setSearching(false);
    }
  };

  const onRoute = useCallback(async () => {
    if (!me) return Alert.alert('Ruta', 'Activa el GPS del celular para calcular la ruta.');
    if (!dest) return Alert.alert('Ruta', 'Selecciona un destino.');
    try {
      setRouting(true);
      const res = await apiRequest<RouteRes>(
        settings.apiBaseUrl,
        `/geo/route${toQuery({
          startLat: me.lat,
          startLng: me.lng,
          endLat: dest.lat,
          endLng: dest.lng,
          profile,
        })}`,
        { method: 'GET', timeoutMs: 90_000 }
      );
      if (res?.error) {
        Alert.alert('Ruta', String(res.error));
        return;
      }
      const geom = Array.isArray(res?.geometry) ? res.geometry : [];
      setRoutePoints(geom.map((p) => normalizeLatLng(p, false)).filter((p): p is LatLng => p != null));
      setRouteMeta({
        distanceM: res.distance_m != null ? Number(res.distance_m) : undefined,
        durationS: res.duration_s != null ? Number(res.duration_s) : undefined,
      });
    } catch (error: unknown) {
      Alert.alert('Ruta', error instanceof Error ? error.message : 'No se pudo calcular la ruta.');
    } finally {
      setRouting(false);
    }
  }, [dest, me, profile, settings.apiBaseUrl]);

  useEffect(() => {
    if (!normalizeLatLng({ lat: params.destLat, lng: params.destLng })) return;
    if (!me) return;
    if (!dest) return;
    if (routing) return;
    if (routePoints.length) return;

    void onRoute();
  }, [dest, me, onRoute, params.destLat, params.destLng, profile, routePoints.length, routing]);

  const formatKm = (m?: number) => (m == null || !Number.isFinite(m) ? '—' : `${(m / 1000).toFixed(2)} km`);
  const formatMin = (s?: number) => (s == null || !Number.isFinite(s) ? '—' : `${Math.max(1, Math.round(s / 60))} min`);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.h1}>🧭 Ir a un lugar</Text>
        <Text style={styles.sub}>Busca un destino y verás la ruta en el mapa</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Destino</Text>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ej: Metrocentro, San Salvador"
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={() => void onSearch()}
          />
          <Pressable onPress={() => void onSearch()} style={[styles.searchBtn, searching && { opacity: 0.7 }]} disabled={searching} accessibilityRole="button">
            <Text style={styles.searchText}>{searching ? '…' : 'Buscar'}</Text>
          </Pressable>
        </View>

        <View style={styles.profileRow}>
          <Pressable
            onPress={() => setProfile('walking')}
            style={[styles.profilePill, profile === 'walking' && styles.profilePillActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.profileText, profile === 'walking' && styles.profileTextActive]}>🚶 Caminar</Text>
          </Pressable>
          <Pressable
            onPress={() => setProfile('cycling')}
            style={[styles.profilePill, profile === 'cycling' && styles.profilePillActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.profileText, profile === 'cycling' && styles.profileTextActive]}>🚴 Bici</Text>
          </Pressable>
        </View>

        {searching ? (
          <View style={{ paddingVertical: 6 }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : results.length ? (
          <View style={{ gap: 10 }}>
            {results.map((r, idx) => {
              const isSel = selectedKey === resultKey(r);
              return (
                <Pressable
                  key={`${String(r.display_name ?? 'res')}-${idx}`}
                  onPress={() => {
                    setSelected(r);
                    setSelectedKey(resultKey(r));
                  }}
                  style={[styles.resultRow, isSel && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {r.display_name ?? 'Lugar'}
                  </Text>
                  <Text style={styles.resultSub}>{r.type ? String(r.type) : '—'}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.note}>Escribe un destino y toca Buscar.</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Ruta</Text>
        <Text style={styles.note}>{gpsOk ? 'GPS activo (celular)' : 'GPS apagado o sin permisos'}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>📏 {formatKm(routeMeta?.distanceM)}</Text>
          <Text style={styles.meta}>🕐 {formatMin(routeMeta?.durationS)}</Text>
        </View>

        <LargeButton title={routing ? 'Calculando…' : 'Calcular ruta'} onPress={onRoute} disabled={routing} variant="primary" />
      </Card>

      <Card style={[styles.card, { padding: 0, overflow: 'hidden', minHeight: 260 }]}>
        {region ? (
          <View style={{ width: '100%', height: 320 }}>
            <LiveMap
              region={region}
              points={routePoints}
              current={me}
              destination={dest}
              plannedRoutePoints={routePoints}
              permissionOk={gpsOk}
              followUserLocation={routePoints.length < 2}
              interactionMode={routePoints.length >= 2 ? 'route_navigation' : 'follow_zoom'}
            />
          </View>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.note}>Activa el GPS para ver el mapa.</Text>
          </View>
        )}
      </Card>
    </Screen>
  );
}

async function buscarLugar(texto: string): Promise<LugarBuscado[]> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(texto)}` +
    `&format=json&limit=5&countrycodes=sv&accept-language=es`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SendaVida/1.0',
    },
  });
  if (!res.ok) {
    throw new Error('No se encontraron lugares disponibles.');
  }
  const data = (await res.json()) as Array<{ display_name?: unknown; lat?: unknown; lon?: unknown }>;
  return (Array.isArray(data) ? data : [])
    .map((item) => ({
      nombre: item.display_name != null ? String(item.display_name) : 'Lugar sin nombre',
      lat: Number(item.lat),
      lon: Number(item.lon),
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  h1: { fontSize: 20, fontWeight: '900', color: colors.text, fontFamily },
  sub: { color: colors.muted, fontWeight: '700', fontFamily },

  card: { gap: 12 },
  cardTitle: { color: colors.text, fontWeight: '900', fontSize: 16, fontFamily },
  note: { color: colors.muted, fontWeight: '700', fontFamily },

  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily, color: colors.text, fontWeight: '700' },
  searchBtn: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.primary },
  searchText: { color: 'white', fontWeight: '900', fontFamily },

  profileRow: { flexDirection: 'row', gap: 10 },
  profilePill: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surface },
  profilePillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  profileText: { color: colors.text, fontWeight: '900', fontFamily },
  profileTextActive: { color: colors.primary },

  resultRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, backgroundColor: colors.surface, gap: 4 },
  resultTitle: { color: colors.text, fontWeight: '900', fontFamily },
  resultSub: { color: colors.muted, fontWeight: '700', fontFamily, fontSize: 12 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: colors.muted, fontWeight: '800', fontFamily },

  mapPlaceholder: { height: 320, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
});


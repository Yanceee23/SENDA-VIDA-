import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { apiRequest } from '../services/api';
import { Card } from '../components/Card';
import { LargeButton } from '../components/LargeButton';
import { RequireAccountModal } from '../components/RequireAccountModal';
import { useAuth } from '../state/AuthContext';
import { useSettings } from '../state/SettingsContext';
import { getOfflineRoutesState, toggleOfflineRoute } from '../services/offlineRoutes';
import { colors } from '../theme/colors';
import type { AppStackParamList } from '../types/navigation';
import { fontFamily } from '../theme/typography';
import { distanciaKm, type LatLng } from '../utils/gps';
import { getOsrmRoute } from '../services/osrmService';
import { fetchEcoPlacesFromBackend } from '../services/ecoPlacesBackendService';
import { getPlacesByCategory, type OverpassPlace, type PlaceCategory } from '../services/overpassService';

type Ruta = {
  id: number;
  tipo: string;
  nombre: string;
  distanciaKm?: number;
  tiempoMin?: number;
  dificultad?: string;
  nivelSeguridad?: string;
  profundidad?: number;
  longitud?: number;
  ancho?: number;
  altura?: number;
  gpsInicio?: any;
  gpsFin?: any;
  mapaOffline?: boolean;
  puntosInteres?: string;
};

type EcoPlace = {
  id: string;
  osm_type?: string;
  osm_id?: string | number;
  nombre: string;
  tipo: string;
  lat: number;
  lng: number;
  descripcion?: string;
};

function uiTipoToPlaceCategory(raw: string): PlaceCategory | null {
  const k = String(raw ?? '').toLowerCase().trim();
  const map: Record<string, PlaceCategory> = {
    volcanes: 'volcanes',
    playas: 'playas',
    cascadas: 'cascadas',
    'montanas-parques': 'montanas-parques',
    montanas: 'montanas',
    parques: 'parques',
    rios: 'rios',
    lagos: 'lagos',
  };
  return map[k] ?? null;
}

const tipos = [
  { key: 'todas', label: 'Todas', emoji: '🧭' },
  { key: 'volcanes', label: '🌋 Volcanes', emoji: '🌋' },
  { key: 'montanas', label: '⛰️ Montañas', emoji: '⛰️' },
  { key: 'parques', label: '🌳 Parques', emoji: '🌳' },
  { key: 'rios', label: '💧 Ríos', emoji: '💧' },
  { key: 'lagos', label: '🏞️ Lagos', emoji: '🏞️' },
  { key: 'playas', label: '🏖️ Playas', emoji: '🏖️' },
  { key: 'cascadas', label: '💦 Cascadas', emoji: '💦' },
] as const;

export function SafeRoutesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { status, user } = useAuth();
  const { settings } = useSettings();
  const [mode, setMode] = useState<'rutas' | 'lugares'>('rutas');
  const [tipo, setTipo] = useState<string>('todas');
  const [loading, setLoading] = useState(false);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [requireModal, setRequireModal] = useState<{ visible: boolean; ruta: Ruta | null }>({ visible: false, ruta: null });
  const [offlineIds, setOfflineIds] = useState<Set<number>>(new Set());
  const [offlineBusyId, setOfflineBusyId] = useState<number | null>(null);

  const [placeQuery, setPlaceQuery] = useState('');
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesLoadingMore, setPlacesLoadingMore] = useState(false);
  const [places, setPlaces] = useState<EcoPlace[]>([]);
  const [placesTotal, setPlacesTotal] = useState(0);
  const [placesPage, setPlacesPage] = useState(0);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [etaMinByPlace, setEtaMinByPlace] = useState<Record<string, number>>({});
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [gpsOk, setGpsOk] = useState(false);
  const placesReqSeq = useRef(0);

  const isEcoTipo = (t: string) => ['rios', 'lagos', 'playas', 'volcanes', 'montanas', 'parques', 'cascadas'].includes(String(t ?? '').toLowerCase().trim());
  const showPlacesView = mode === 'lugares' || (mode === 'rutas' && isEcoTipo(tipo));

  useEffect(() => {
    (async () => {
      const st = await getOfflineRoutesState();
      setOfflineIds(new Set(st.ids));
    })();
  }, []);

  const fetchRutas = async (t: string) => {
    try {
      setLoading(true);
      const endpoint = t === 'todas' ? '/rutas' : `/rutas/tipo/${encodeURIComponent(t)}`;
      const res = await apiRequest<any[]>(settings.apiBaseUrl, endpoint, {
        token: user?.token,
      });
      const list = Array.isArray(res) ? res : [];
      setRutas(
        list.map((r: any) => ({
          id: Number(r.id),
          tipo: String(r.tipo ?? t),
          nombre: String(r.nombre ?? 'Ruta'),
          distanciaKm: r.distanciaKm != null ? Number(r.distanciaKm) : r.distancia_km != null ? Number(r.distancia_km) : undefined,
          tiempoMin: r.tiempoMin != null ? Number(r.tiempoMin) : r.tiempo_min != null ? Number(r.tiempo_min) : undefined,
          dificultad: r.dificultad != null ? String(r.dificultad) : undefined,
          nivelSeguridad: r.nivelSeguridad != null ? String(r.nivelSeguridad) : r.nivel_seguridad != null ? String(r.nivel_seguridad) : undefined,
          profundidad: r.profundidad != null ? Number(r.profundidad) : undefined,
          longitud: r.longitud != null ? Number(r.longitud) : undefined,
          ancho: r.ancho != null ? Number(r.ancho) : undefined,
          altura: r.altura != null ? Number(r.altura) : undefined,
          gpsInicio: r.gpsInicio ?? r.gps_inicio,
          gpsFin: r.gpsFin ?? r.gps_fin,
          mapaOffline: Boolean(r.mapaOffline ?? r.mapa_offline ?? false),
          puntosInteres: r.puntosInteres != null ? String(r.puntosInteres) : r.puntos_interes != null ? String(r.puntos_interes) : undefined,
        }))
      );
    } catch (e: any) {
      // Fallback: cargar desde JSON embebido en la app
      try {
        const fallback: Ruta[] = require('../data/rutas.json');
        const list = Array.isArray(fallback) ? fallback : [];
        const tNorm = String(t ?? '').toLowerCase().trim();
        const filtered =
          tNorm === 'todas'
            ? list
            : list.filter((x) => String(x?.tipo ?? '').toLowerCase().trim() === tNorm);
        setRutas(filtered);
      } catch {
        setRutas([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== 'rutas') return;
    if (showPlacesView) return; // Ríos/Lagos/Playas se resuelven como "lugares" (API gratis) en vez de BD
    void fetchRutas(tipo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tipo, settings.apiBaseUrl, user?.token]);

  const fetchPlaces = async ({ reset, tipo: tipoReq }: { reset: boolean; tipo: string }) => {
    if (placesLoading || placesLoadingMore) return;
    const effectiveTipo = String(tipoReq ?? '').toLowerCase().trim();
    if (!effectiveTipo || effectiveTipo === 'todas') return;
    const reqId = ++placesReqSeq.current;

    try {
      if (reset) setPlacesLoading(true);
      else setPlacesLoadingMore(true);
      if (reset) setPlacesError(null);

      const category = uiTipoToPlaceCategory(effectiveTipo);
      if (!category) return;

      const base = (settings.apiBaseUrl ?? '').trim();
      let res: OverpassPlace[];
      if (base) {
        try {
          const fromApi = await fetchEcoPlacesFromBackend(base, category, user?.token);
          // Prioridad backend: [] es válido y no debe forzar fallback.
          res = fromApi;
        } catch {
          // Fallback solo en error real de red/servidor.
          res = await getPlacesByCategory(category);
        }
      } else {
        res = await getPlacesByCategory(category);
      }
      if (reqId !== placesReqSeq.current) return;
      const filtered = res.filter((p) => p.nombre.toLowerCase().includes(placeQuery.trim().toLowerCase()));
      const mapped: EcoPlace[] = filtered.map((x: OverpassPlace) => {
        const parts = x.id.split(':');
        return {
          id: x.id,
          osm_type: parts[0],
          osm_id: parts[1],
          nombre: x.nombre,
          tipo: category,
          lat: x.lat,
          lng: x.lng,
          descripcion: x.descripcion,
        };
      });
      setPlacesTotal(mapped.length);
      setPlacesPage(0);
      setPlaces(mapped);
    } catch (e: any) {
      if (reqId !== placesReqSeq.current) return;
      if (reset) setPlaces([]);
      if (reset) setPlacesError(String(e?.message ?? 'No se pudieron cargar lugares.'));
    } finally {
      if (reqId !== placesReqSeq.current) return;
      setPlacesLoading(false);
      setPlacesLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!showPlacesView) return;

    // En modo Lugares no existe "todas": forzamos una categoría por defecto.
    if (mode === 'lugares' && tipo === 'todas') {
      setTipo('playas');
      return;
    }
    if (tipo === 'todas') return;

    const id = setTimeout(() => {
      void fetchPlaces({ reset: true, tipo });
    }, 350);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tipo, placeQuery, settings.apiBaseUrl, user?.token]);

  useEffect(() => {
    if (!showPlacesView) return;

    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          setGpsOk(false);
          setMyPos(null);
          return;
        }
        setGpsOk(true);
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setGpsOk(false);
        setMyPos(null);
      }
    })();
  }, [showPlacesView]);

  const tituloTipo = useMemo(() => tipos.find((x) => x.key === tipo)?.label ?? tipo, [tipo]);

  const startFromRoute = (r: Ruta, saveToDb: boolean) => {
    const nivelSeguridad = r.nivelSeguridad ?? undefined;
    Alert.alert('Iniciar actividad', 'Selecciona el tipo de actividad', [
      { text: 'Ciclismo', onPress: () => navigation.navigate('ActiveRoute', { tipo: 'ciclismo', rutaId: r.id, rutaNombre: r.nombre, saveToDb, nivelSeguridad }) },
      { text: 'Senderismo', onPress: () => navigation.navigate('ActiveRoute', { tipo: 'senderismo', rutaId: r.id, rutaNombre: r.nombre, saveToDb, nivelSeguridad }) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const startToDestination = async (p: EcoPlace) => {
    let origin = myPos;
    if (!origin) {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPos(origin);
      } catch {
        Alert.alert('GPS', 'Activa GPS para calcular ruta.');
      }
    }
    if (origin) {
      try {
        const routeMode = routeModeForTipo(tipo);
        const osrm = await getOsrmRoute({
          mode: routeMode,
          startLat: origin.lat,
          startLng: origin.lng,
          endLat: p.lat,
          endLng: p.lng,
        });
        const key = p.id ?? `${p.osm_type ?? 'p'}:${String(p.osm_id ?? `${p.lat},${p.lng}`)}`;
        setEtaMinByPlace((prev) => ({ ...prev, [key]: osrm.durationMin }));
        Alert.alert('Ruta estimada', `Tiempo aproximado: ${Math.max(1, Math.round(osrm.durationMin))} min`);
      } catch {
        // ignore ETA failure
      }
    }
    Alert.alert('Iniciar navegación', 'Selecciona el tipo de actividad', [
      {
        text: 'Ciclismo',
        onPress: () =>
          navigation.navigate('ActiveRoute', {
            tipo: 'ciclismo',
            saveToDb: false,
            rutaNombre: p.nombre,
            destLat: p.lat,
            destLng: p.lng,
            destNombre: p.nombre,
          }),
      },
      {
        text: 'Senderismo',
        onPress: () =>
          navigation.navigate('ActiveRoute', {
            tipo: 'senderismo',
            saveToDb: false,
            rutaNombre: p.nombre,
            destLat: p.lat,
            destLng: p.lng,
            destNombre: p.nombre,
          }),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const onToggleOffline = async (r: Ruta) => {
    try {
      setOfflineBusyId(r.id);
      const { state, downloaded } = await toggleOfflineRoute({
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        gpsInicio: r.gpsInicio,
        gpsFin: r.gpsFin,
        downloadedAt: new Date().toISOString(),
      });
      setOfflineIds(new Set(state.ids));
      Alert.alert(
        downloaded ? 'Mapa offline listo' : 'Mapa offline removido',
        downloaded
          ? 'Guardamos un paquete simple para usar como mapa offline en la ruta.'
          : 'Quitamos la ruta de tu lista offline.'
      );
    } catch (e: any) {
      Alert.alert('No se pudo actualizar', e?.message ?? 'Error');
    } finally {
      setOfflineBusyId(null);
    }
  };

  const ModeToggle = (
    <View style={styles.modeRow}>
      <Pressable
        onPress={() => setMode('rutas')}
        style={[styles.modePill, mode === 'rutas' && styles.modePillActive]}
        accessibilityRole="button"
      >
        <Text style={[styles.modeText, mode === 'rutas' && styles.modeTextActive]}>Rutas</Text>
      </Pressable>
      <Pressable
        onPress={() => setMode('lugares')}
        style={[styles.modePill, mode === 'lugares' && styles.modePillActive]}
        accessibilityRole="button"
      >
        <Text style={[styles.modeText, mode === 'lugares' && styles.modeTextActive]}>Lugares</Text>
      </Pressable>
    </View>
  );

  if (showPlacesView) {
    const effectiveTipo = tipo === 'todas' ? 'playas' : tipo;
    const titulo = tipos.find((x) => x.key === effectiveTipo)?.label ?? effectiveTipo;
    const hasSearch = placeQuery.trim().length > 0;

    return (
      <Screen contentStyle={{ padding: 0, gap: 0 }}>
        <View style={{ padding: 18, gap: 14 }}>
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.dispatch(DrawerActions.openDrawer());
              }}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Atrás"
            >
              <Text style={styles.back}>←</Text>
            </Pressable>
            <Text style={styles.h1}>{mode === 'lugares' ? 'Rutas' : 'Rutas Seguras'}</Text>
            <View style={{ width: 44 }} />
          </View>

          {ModeToggle}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
            {tipos
              .filter((t) => (mode === 'lugares' ? t.key !== 'todas' : true))
              .map((t) => {
                const active = effectiveTipo === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setTipo(t.key)}
                    style={[styles.pill, active && styles.pillActive]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
          </ScrollView>

          <TextInput
            value={placeQuery}
            onChangeText={setPlaceQuery}
            placeholder="Buscar por nombre (ej: Costa del Sol)"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCapitalize="words"
          />

          <Text style={styles.section}>
            {placesLoading ? 'Cargando…' : `${titulo}${placesTotal ? ` (${placesTotal})` : ''}`}
          </Text>
          <Text style={styles.smallNote}>{gpsOk ? 'Distancia calculada desde tu GPS' : 'Activa GPS para ver km'}</Text>

          {placesError ? (
            <Card style={{ gap: 8, backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderWidth: 1 }}>
              <Text style={[styles.routeName, { fontSize: 14 }]}>No se pudieron cargar los lugares</Text>
              <Text style={styles.note}>{placesError}</Text>
              <LargeButton
                title="Reintentar"
                onPress={() => void fetchPlaces({ reset: true, tipo: effectiveTipo })}
                variant="outlinePrimary"
                style={{ minHeight: 44, paddingVertical: 10, borderRadius: 14 }}
              />
            </Card>
          ) : null}
        </View>

        <FlatList
          data={places}
          keyExtractor={(p) => p.id ?? `${p.osm_type ?? 'p'}:${String(p.osm_id ?? '')}`}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}
          onEndReached={() => {
            if (placesLoading || placesLoadingMore) return;
            if (places.length >= placesTotal) return;
            void fetchPlaces({ reset: false, tipo: effectiveTipo });
          }}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => {
            const dist =
              myPos ? `${distanciaKm(myPos, { lat: item.lat, lng: item.lng }).toFixed(2)} km` : '— km';
            return (
              <Card style={styles.placeCard}>
                <Text style={styles.routeName}>{item.nombre}</Text>
                <Text style={styles.routeType}>
                  {labelTipo(item.tipo)} • 📍 {dist}
                </Text>
                <Text style={styles.note}>{item.descripcion ?? 'Lugar natural en El Salvador.'}</Text>
                {(() => {
                  const key = item.id ?? `${item.osm_type ?? 'p'}:${String(item.osm_id ?? `${item.lat},${item.lng}`)}`;
                  const eta = etaMinByPlace[key];
                  if (eta == null) return null;
                  return <Text style={styles.metaText}>⏱ {Math.max(1, Math.round(eta))} min estimados</Text>;
                })()}

                <View style={styles.placeBtns}>
                  <Pressable
                    onPress={() =>
                      mode === 'rutas'
                        ? void startToDestination(item)
                        : navigation.navigate('NavigateToPlace', { destLat: item.lat, destLng: item.lng, destNombre: item.nombre })
                    }
                    style={[styles.placeBtn, styles.placeBtnPrimary]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.placeBtnText}>Ir</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      navigation.navigate('EnvironmentalInfo', {
                        lat: item.lat,
                        lng: item.lng,
                        nombre: item.nombre,
                        tipo: wikidataTipoFromRutaTipo(item.tipo),
                        autoFetch: true,
                        useDeviceGps: false,
                      })
                    }
                    style={[styles.placeBtn, styles.placeBtnNeutral]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.placeBtnTextNeutral}>Ver entorno</Text>
                  </Pressable>
                </View>
              </Card>
            );
          }}
          ListFooterComponent={placesLoadingMore ? <ActivityIndicator /> : null}
          ListEmptyComponent={
            !placesLoading ? (
              <Text style={styles.emptyText}>
                {placesError ? 'Sin datos (error de conexión)' : hasSearch ? 'No hay coincidencias para tu búsqueda.' : 'Sin resultados.'}
              </Text>
            ) : null
          }
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <RequireAccountModal
        visible={requireModal.visible}
        onClose={() => setRequireModal({ visible: false, ruta: null })}
        onCreateAccount={() => {
          setRequireModal({ visible: false, ruta: null });
          navigation.navigate('Register');
        }}
        onContinueNoSave={() => {
          const r = requireModal.ruta;
          setRequireModal({ visible: false, ruta: null });
          if (r) startFromRoute(r, false);
        }}
      />

      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.dispatch(DrawerActions.openDrawer());
          }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Atrás"
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.h1}>Rutas Seguras</Text>
        <View style={{ width: 44 }} />
      </View>

      {ModeToggle}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {tipos.map((t) => {
          const active = tipo === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTipo(t.key)}
              style={[styles.pill, active && styles.pillActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.section}>{loading ? 'Cargando…' : tituloTipo}</Text>

      <View style={{ gap: 14 }}>
        {rutas.map((r) => (
          (() => {
            const downloaded = offlineIds.has(r.id);
            const busy = offlineBusyId === r.id;
            return (
          <Card key={r.id} style={styles.routeCard}>
            <View style={styles.routeTop}>
              <View style={styles.routeLeft}>
                <Text style={styles.routeEmoji}>{emojiPorTipo(r.tipo)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeName}>{r.nombre}</Text>
                  <Text style={styles.routeType}>{labelTipo(r.tipo)}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => void onToggleOffline(r)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Descargar"
              >
                <Text style={styles.download}>{busy ? '…' : downloaded ? '✅' : '⬇️'}</Text>
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              <Meta icon="📍" text={r.distanciaKm != null ? `${r.distanciaKm.toFixed(1)} km` : '— km'} />
              <Meta icon="🕐" text={r.tiempoMin != null ? `${Math.round(r.tiempoMin)} min` : tiempoEstimado(r.distanciaKm)} />
              <Meta icon="⛰️" text={r.dificultad ?? '—'} />
              <Meta icon="🛡️" text={r.nivelSeguridad ?? '—'} />
              <Meta icon="⬇️" text={downloaded ? 'Offline' : '—'} />
              {r.profundidad != null ? <Meta icon="🌊" text={`${r.profundidad.toFixed(1)} m`} /> : null}
            </View>

            <Text style={styles.note}>{r.puntosInteres ?? 'Miradores, refugios, puntos de interés'}</Text>

            <LargeButton
              title="Ir →"
              onPress={() => {
                if (status !== 'signedIn') {
                  setRequireModal({ visible: true, ruta: r });
                  return;
                }
                startFromRoute(r, true);
              }}
              variant="primary"
              style={{ minHeight: 46, paddingVertical: 12, borderRadius: 18 }}
            />

            <Pressable
              onPress={() => {
                const start = parseGps(r.gpsInicio);
                if (!start) {
                  Alert.alert('Wiki', 'Esta ruta no tiene GPS de inicio para buscar información.');
                  return;
                }
                navigation.navigate('EnvironmentalInfo', {
                  lat: start.lat,
                  lng: start.lng,
                  nombre: r.nombre,
                  tipo: wikidataTipoFromRutaTipo(r.tipo),
                });
              }}
              accessibilityRole="button"
              style={styles.mapsLink}
            >
              <Text style={styles.mapsText}>Ver datos (Wiki)</Text>
            </Pressable>
          </Card>
            );
          })()
        ))}
      </View>

      {!loading && rutas.length === 0 ? <Text style={styles.emptyText}>No hay rutas para esta categoría.</Text> : null}
    </Screen>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaIcon}>{icon}</Text>
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function parseGps(raw: any): { lat: number; lng: number } | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      if (typeof j?.lat === 'number' && typeof j?.lng === 'number') return { lat: j.lat, lng: j.lng };
    } catch {
      return null;
    }
  }
  if (typeof raw?.lat === 'number' && typeof raw?.lng === 'number') return { lat: raw.lat, lng: raw.lng };
  return null;
}

function tiempoEstimado(distKm?: number) {
  if (!distKm || !Number.isFinite(distKm)) return '—';
  const horas = distKm / 4; // senderismo promedio
  const mins = Math.round(horas * 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} h ${m} min`;
}

function emojiPorTipo(tipo: string) {
  const t = String(tipo ?? '').toLowerCase();
  if (t.includes('volcan')) return '🌋';
  if (t.includes('mont')) return '⛰️';
  if (t.includes('parq')) return '🌳';
  if (t.includes('rio')) return '💧';
  if (t.includes('lago')) return '🏞️';
  if (t.includes('play')) return '🏖️';
  return '🗺️';
}

function labelTipo(tipo: string) {
  const t = String(tipo ?? '').toLowerCase();
  if (t === 'volcanes') return 'Volcanes';
  if (t === 'montanas') return 'Montañas';
  if (t === 'parques') return 'Parques';
  if (t === 'rios') return 'Ríos';
  if (t === 'lagos') return 'Lagos';
  if (t === 'playas') return 'Playas';
  if (t === 'cascadas') return 'Cascadas';
  return tipo;
}

function routeModeForTipo(tipo: string): 'foot' | 'bike' {
  const t = String(tipo ?? '').toLowerCase();
  if (t.includes('bici') || t.includes('cicl')) return 'bike';
  return 'foot';
}

function wikidataTipoFromRutaTipo(tipo: string) {
  const t = String(tipo ?? '').toLowerCase();
  if (t.includes('volcan')) return 'volcan';
  if (t.includes('mont')) return 'montana';
  if (t.includes('parq')) return 'parque';
  if (t.includes('rio')) return 'rio';
  if (t.includes('lago')) return 'lago';
  if (t.includes('play')) return 'playa';
  return 'parque';
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.text, fontSize: 22, fontWeight: '900', fontFamily },
  h1: { fontSize: 20, fontWeight: '900', color: colors.text, fontFamily },

  modeRow: { flexDirection: 'row', gap: 10 },
  modePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  modePillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  modeText: { color: colors.text, fontWeight: '900', fontFamily },
  modeTextActive: { color: colors.primary },

  pills: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.text, fontWeight: '800', fontFamily },
  pillTextActive: { color: 'white' },

  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily,
    color: colors.text,
    fontWeight: '700',
  },
  smallNote: { color: colors.muted, fontWeight: '700', fontFamily, fontSize: 12 },

  section: { marginTop: 6, color: colors.text, fontWeight: '900', fontSize: 16, fontFamily },

  routeCard: { gap: 12 },
  routeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  routeLeft: { flexDirection: 'row', gap: 12, flex: 1, paddingRight: 10 },
  routeEmoji: { fontSize: 32 },
  routeName: { color: colors.text, fontWeight: '900', fontSize: 16, fontFamily },
  routeType: { color: colors.muted, fontWeight: '700', marginTop: 2, fontFamily },
  download: { fontSize: 20 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#F9FAFB', borderRadius: 999 },
  metaIcon: { fontSize: 14 },
  metaText: { color: colors.muted, fontWeight: '800', fontFamily },

  note: { color: colors.muted, fontWeight: '600', lineHeight: 18, fontFamily },
  mapsLink: { paddingTop: 2 },
  mapsText: { color: colors.muted, fontWeight: '700', textAlign: 'center', fontFamily },
  emptyText: { color: colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 16, fontFamily },

  placeCard: { gap: 10 },
  placeBtns: { flexDirection: 'row', gap: 10 },
  placeBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  placeBtnPrimary: { backgroundColor: colors.primary },
  placeBtnNeutral: { backgroundColor: '#111827' },
  placeBtnText: { color: 'white', fontWeight: '900', fontFamily },
  placeBtnTextNeutral: { color: 'white', fontWeight: '900', fontFamily },
});


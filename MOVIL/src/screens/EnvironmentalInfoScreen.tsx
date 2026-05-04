import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { Card } from '../components/Card';
import { LargeButton } from '../components/LargeButton';
import { apiRequest, toQuery } from '../services/api';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme/colors';
import type { AppStackParamList } from '../types/navigation';
import { fontFamily } from '../theme/typography';
import * as Location from 'expo-location';
import { getWikidataInfoByPlaceName } from '../services/wikidataService';
import { getEspeciesPorUbicacion } from '../services/gbifService';
import { reverseGeocode } from '../services/nominatimService';
import { getNearbyPois } from '../services/overpassPoisService';
import { obtenerClimaPorCoords } from '../services/climaService';

type Props = NativeStackScreenProps<AppStackParamList, 'EnvironmentalInfo'>;

type ExplorerResult = {
  clima?: any;
  especies?: {
    flora?: Array<{ nombre?: string }>;
    floraTotal?: number;
    fauna?: Array<{ nombre?: string }>;
    faunaTotal?: number;
  };
  zona_protegida?: any;
  wikidata?: any;
};

type GeoReverse = {
  pais?: string;
  pais_codigo?: string;
  region?: string;
  ciudad?: string;
  barrio?: string;
  display_name?: string;
};

type Poi = {
  nombre?: string;
  tipo?: string;
  distancia_km?: number;
};

function hasSpeciesData(especies: ExplorerResult['especies'] | null | undefined): especies is NonNullable<ExplorerResult['especies']> {
  if (!especies) return false;
  const floraCount = Number(especies.floraTotal ?? 0);
  const faunaCount = Number(especies.faunaTotal ?? 0);
  const floraItems = Array.isArray(especies.flora) ? especies.flora.length : 0;
  const faunaItems = Array.isArray(especies.fauna) ? especies.fauna.length : 0;
  return floraCount > 0 || faunaCount > 0 || floraItems > 0 || faunaItems > 0;
}

export function EnvironmentalInfoScreen({ navigation, route }: Props) {
  const { settings } = useSettings();
  const { useDeviceGps, autoFetch } = route.params;
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: route.params.lat, lng: route.params.lng });
  const [nombre, setNombre] = useState(route.params.nombre ?? 'Lugar visitado');
  const [tipo, setTipo] = useState(route.params.tipo ?? 'parque');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExplorerResult | null>(null);
  const [geo, setGeo] = useState<GeoReverse | null>(null);
  const [pois, setPois] = useState<Poi[]>([]);
  const [wikidataMobile, setWikidataMobile] = useState<{
    label: string;
    description: string;
    elevationM: number | null;
    imageUrl: string | null;
  } | null>(null);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [gpsResolved, setGpsResolved] = useState(!useDeviceGps);

  const zonaProtegida = data?.zona_protegida;
  const especies = data?.especies;
  const wikidata = data?.wikidata;

  const wikiLabel = useMemo(() => {
    if (!wikidata) return null;
    return (
      (wikidata.label != null ? String(wikidata.label) : null) ||
      (wikidata.lugarLabel != null ? String(wikidata.lugarLabel) : null) ||
      (wikidata.nombre != null ? String(wikidata.nombre) : null)
    );
  }, [wikidata]);

  const wikiDescription = useMemo(() => {
    if (!wikidata) return null;
    return (
      (wikidata.description != null ? String(wikidata.description) : null) ||
      (wikidata.descripcion != null ? String(wikidata.descripcion) : null) ||
      (wikidata.nota != null ? String(wikidata.nota) : null)
    );
  }, [wikidata]);

  const floraCount = useMemo(() => Number(especies?.floraTotal ?? 0), [especies]);
  const faunaCount = useMemo(() => Number(especies?.faunaTotal ?? 0), [especies]);
  const floraNombres = useMemo(
    () =>
      Array.isArray(especies?.flora)
        ? especies.flora.map((x: any) => String(x?.nombre ?? x?.name ?? '').trim()).filter(Boolean)
        : [],
    [especies]
  );
  const faunaNombres = useMemo(
    () =>
      Array.isArray(especies?.fauna)
        ? especies.fauna.map((x: any) => String(x?.nombre ?? x?.name ?? '').trim()).filter(Boolean)
        : [],
    [especies]
  );

  const onFetch = async () => {
    try {
      setLoading(true);
      const { lat, lng } = coords;
      const cleanName = nombre.trim() || 'Lugar visitado';
      const cleanTipo = tipo.trim() || 'parque';
      const baseUrl = (settings.apiBaseUrl ?? '').trim();

      // Flora y fauna SIEMPRE según GPS - directo desde GBIF (no requiere backend)
      const especiesTask = getEspeciesPorUbicacion(lat, lng, 15);
      const wikiTask = getWikidataInfoByPlaceName(cleanName);

      const geoTask = baseUrl
        ? apiRequest<GeoReverse>(baseUrl, `/geo/reverse${toQuery({ lat, lng })}`, { method: 'GET' })
        : reverseGeocode(lat, lng);
      const poisTask = baseUrl
        ? apiRequest<Poi[]>(baseUrl, `/geo/pois${toQuery({ lat, lng, radiusM: 8000, limit: 8 })}`, { method: 'GET' })
        : getNearbyPois(lat, lng, 8000, 8);
      const explorerTask = baseUrl
        ? apiRequest<ExplorerResult>(baseUrl, `/explorer/explorar${toQuery({ lat, lng, nombre: cleanName, tipo: cleanTipo })}`, { method: 'POST' })
        : null;
      const climaTask = baseUrl ? null : obtenerClimaPorCoords(lat, lng).catch(() => null);

      const [especiesRes, explorerRes, geoRes, poisRes, wikiRes, climaRes] = await Promise.allSettled([
        especiesTask,
        explorerTask ?? Promise.resolve(null),
        geoTask,
        poisTask,
        wikiTask,
        climaTask ?? Promise.resolve(null),
      ]);

      const explorerValue = explorerRes.status === 'fulfilled' ? explorerRes.value : null;
      const especiesFromBackend = hasSpeciesData(explorerValue?.especies) ? explorerValue.especies : null;
      const especiesFromGbif = especiesRes.status === 'fulfilled' ? especiesRes.value : null;
      const finalEspecies = especiesFromBackend ?? especiesFromGbif ?? { flora: [], floraTotal: 0, fauna: [], faunaTotal: 0 };

      const climaFromBackend = explorerValue?.clima ?? null;
      const climaFromDirect = climaRes?.status === 'fulfilled' && climaRes.value
        ? { temperatura: climaRes.value.temperaturaC, condicion: climaRes.value.condicion }
        : null;
      const clima = climaFromBackend ?? climaFromDirect ?? { condicion: 'Sin datos disponibles' };

      const nextData: ExplorerResult = {
        clima,
        especies: finalEspecies,
        zona_protegida: explorerValue?.zona_protegida ?? null,
        wikidata: explorerValue?.wikidata ?? null,
      };
      setData(nextData);
      setGeo(geoRes.status === 'fulfilled' ? geoRes.value : null);
      setPois(poisRes.status === 'fulfilled' && Array.isArray(poisRes.value) ? poisRes.value : []);
      setWikidataMobile({
        label: wikiRes.status === 'fulfilled' ? wikiRes.value.label : cleanName,
        description: wikiRes.status === 'fulfilled' ? wikiRes.value.description : 'Sin datos disponibles',
        elevationM: wikiRes.status === 'fulfilled' ? wikiRes.value.elevationM : null,
        imageUrl: wikiRes.status === 'fulfilled' ? wikiRes.value.imageUrl : null,
      });
    } catch (e: any) {
      Alert.alert('No se pudo cargar la información', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!useDeviceGps) return;

    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          setGpsMsg('GPS no permitido. Usando la última ubicación guardada.');
          setGpsResolved(true);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsMsg('Ubicación actual obtenida del GPS del celular.');
        setGpsResolved(true);
      } catch {
        setGpsMsg('No se pudo obtener GPS. Usando la última ubicación guardada.');
        setGpsResolved(true);
      }
    })();
  }, [useDeviceGps]);

  useEffect(() => {
    if (!autoFetch) return;
    if (!gpsResolved) return;
    if (loading) return;
    if (data) return;

    void onFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, gpsResolved, coords.lat, coords.lng]);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>🐦 🌱 Información Ambiental</Text>
          <Text style={styles.sub}>Datos ecológicos del lugar visitado</Text>
        </View>
      </View>

      <Card style={[styles.card, { backgroundColor: colors.primarySoft }]}>
        <Text style={styles.placeName}>{nombre}</Text>
        <Text style={styles.placeSub}>{wikiDescription ? wikiDescription : `Ecosistema: ${tipo}`}</Text>
        {gpsMsg ? <Text style={styles.placeHint}>🛰️ {gpsMsg}</Text> : null}
        {geo?.pais ? (
          <Text style={styles.placeHint}>
            📍 {geo.ciudad ? `${geo.ciudad}, ` : ''}
            {geo.region ? `${geo.region}, ` : ''}
            {geo.pais}
          </Text>
        ) : null}
        {zonaProtegida?.es_area_protegida ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🛡️ 🔴 Área Natural Protegida{zonaProtegida?.nombre_area ? ` — ${zonaProtegida.nombre_area}` : ''}</Text>
          </View>
        ) : (
          <Text style={styles.placeHint}>Área protegida: (sin datos)</Text>
        )}
      </Card>

      <View style={styles.row2}>
        <Card style={[styles.card, styles.halfCard, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.smallTitle, { color: colors.primary }]}>🌲 {floraCount} Especies de flora</Text>
          <Text style={[styles.smallLine, { color: colors.primary }]}>
            {floraNombres.length ? floraNombres.slice(0, 3).join(', ') : (data ? 'No hay datos para esta ubicación. Prueba en otra zona o más tarde.' : 'Sin datos de flora')}
          </Text>
        </Card>
        <Card style={[styles.card, styles.halfCard, { backgroundColor: '#E8F5F9' }]}>
          <Text style={[styles.smallTitle, { color: colors.accent }]}>🐦 {faunaCount} Especies de fauna</Text>
          <Text style={[styles.smallLine, { color: colors.accent }]}>
            {faunaNombres.length ? faunaNombres.slice(0, 3).join(', ') : (data ? 'No hay datos para esta ubicación. Prueba en otra zona o más tarde.' : 'Sin datos de fauna')}
          </Text>
        </Card>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>🌿 Datos ambientales</Text>
        <Text style={styles.line}>Importancia ecológica: {zonaProtegida?.es_area_protegida ? 'Alta (zona protegida)' : 'Media'}</Text>
        <Text style={styles.line}>Estado de conservación: {zonaProtegida?.es_area_protegida ? 'Protegido' : 'Sin datos'}</Text>
        <Text style={styles.line}>Valor natural: {wikiLabel ? wikiLabel : nombre}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>📚 Wikidata</Text>
        <Text style={styles.line}>Etiqueta: {wikidataMobile?.label ?? wikiLabel ?? 'Sin datos disponibles'}</Text>
        <Text style={styles.line}>Descripción: {wikidataMobile?.description ?? wikiDescription ?? 'Sin datos disponibles'}</Text>
        <Text style={styles.line}>Altura (m): {wikidataMobile?.elevationM != null ? String(wikidataMobile.elevationM) : wikidata?.altura != null ? String(wikidata.altura) : '—'}</Text>
        <Text style={styles.line}>Longitud (m): {wikidata?.longitud != null ? String(wikidata.longitud) : '—'}</Text>
        <Text style={styles.line}>País: {wikidata?.paisLabel != null ? String(wikidata.paisLabel) : '—'}</Text>
        <Text style={styles.line}>Imagen: {wikidataMobile?.imageUrl ?? 'Sin datos disponibles'}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>🧬 Especies (GBIF)</Text>
        {(floraNombres.length || faunaNombres.length) ? (
          [...floraNombres.slice(0, 4), ...faunaNombres.slice(0, 4)].map((nombreEspecie, idx) => (
            <Text key={idx} style={styles.line}>
              - {nombreEspecie}
            </Text>
          ))
        ) : (
          <Text style={styles.line}>{data ? 'No hay datos de especies para esta zona. Prueba otra ubicación o más tarde.' : 'No hay'}</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>📍 Ubicación</Text>
        {geo?.display_name ? (
          <Text style={styles.line}>{geo.display_name}</Text>
        ) : (
          <Text style={styles.line}>Sin datos de ubicación (geo).</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>🧭 Cerca de ti</Text>
        {pois.length ? (
          pois.map((p, idx) => (
            <Text key={idx} style={styles.line}>
              - {p.nombre ?? 'Lugar'}{p.distancia_km != null ? ` (${Number(p.distancia_km).toFixed(2)} km)` : ''}
            </Text>
          ))
        ) : (
          <Text style={styles.line}>{data ? 'No hay lugares cercanos. Prueba en otra zona o más tarde.' : 'Sin lugares cercanos (POIs).'}</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>♻️ Recomendaciones</Text>
        <Text style={styles.bullet}>- 🧴 Lleva tu botella reutilizable</Text>
        <Text style={styles.bullet}>- 🚯 No dejes basura</Text>
        <Text style={styles.bullet}>- 🐾 No molestes a la fauna</Text>
        <Text style={styles.bullet}>- 🌿 Respeta la flora y los senderos</Text>
        {floraCount === 0 && faunaCount === 0 ? <Text style={styles.bullet}>- ℹ No hay datos de especies (GBIF) para esta zona.</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Lugar (editar)</Text>
        <TextField label="Nombre del sitio" value={nombre} onChangeText={setNombre} placeholder="Ej: Volcán X, Parque Y" autoCapitalize="words" />
        <TextField label="Tipo" value={tipo} onChangeText={setTipo} placeholder="Ej: volcan, montaña, río, playa, parque" autoCapitalize="none" />
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        <LargeButton title={loading ? 'Cargando...' : 'Buscar información'} onPress={onFetch} disabled={loading} variant="primary" />
        {(data && floraCount === 0 && faunaCount === 0 && pois.length === 0) ? (
          <Pressable onPress={onFetch} disabled={loading} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        ) : null}
      </Card>

      {data ? (
        <>
          <LargeButton
            title="♻️ Ver retos ecológicos"
            onPress={() => navigation.navigate('EcoChallenges', { usuarioId: undefined, rutaId: undefined })}
            variant="primary"
          />
        </>
      ) : (
        <Text style={styles.hint}>{autoFetch ? 'Cargando datos del entorno…' : 'Toca “Buscar información” para ver datos ambientales del lugar.'}</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.text, fontSize: 22, fontWeight: '900', fontFamily },
  h1: { fontSize: 18, fontWeight: '900', color: colors.text, fontFamily },
  sub: { marginTop: 2, color: colors.muted, fontWeight: '700', fontFamily },
  hint: { color: colors.muted, fontWeight: '700', fontFamily },

  card: { gap: 10 },
  placeName: { color: colors.text, fontWeight: '900', fontSize: 16, fontFamily },
  placeSub: { color: colors.muted, fontWeight: '700', fontFamily },
  placeHint: { color: colors.muted, fontWeight: '700', fontFamily },
  badge: { backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  badgeText: { color: colors.text, fontWeight: '900', fontFamily },

  row2: { flexDirection: 'row', gap: 10 },
  halfCard: { flex: 1 },
  smallTitle: { fontWeight: '900', fontFamily },
  smallLine: { fontWeight: '700', fontFamily },

  cardTitle: { color: colors.text, fontWeight: '900', fontSize: 16, fontFamily },
  line: { color: colors.muted, fontWeight: '700', lineHeight: 20, fontFamily },
  bullet: { color: colors.muted, fontWeight: '700', lineHeight: 20, fontFamily },
  retryBtn: { marginTop: 8, paddingVertical: 8, alignSelf: 'flex-start' },
  retryText: { color: colors.primary, fontWeight: '700', fontFamily },
});


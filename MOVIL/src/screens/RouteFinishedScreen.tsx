import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { apiRequest } from '../services/api';
import { useAuth } from '../state/AuthContext';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme/colors';
import type { AppStackParamList } from '../types/navigation';
import { formatHMS, formatKm } from '../utils/format';
import { fontFamily } from '../theme/typography';
import { Card } from '../components/Card';
import { LargeButton } from '../components/LargeButton';
import * as Location from 'expo-location';
import { requestRouteAdvice } from '../services/geminiService';
import { obtenerClimaActual } from '../services/climaService';
import { getTodayAndMonthStats } from '../services/statsService';

type Props = NativeStackScreenProps<AppStackParamList, 'RouteFinished'>;

type ResumenBackend = {
  distanciaKm?: number;
  calorias?: number;
  tiempoSegundos?: number;
  rutaNombre?: string;
};

export function RouteFinishedScreen({ navigation, route }: Props) {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { summary, actividadId, autoOpenEnvironment, routeAdvice, nivelActual, floraTotal, faunaTotal, floraNombres, faunaNombres } = route.params;
  const [backend, setBackend] = useState<ResumenBackend | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [postAdvice, setPostAdvice] = useState(routeAdvice ?? '');
  const [postAdviceLoading, setPostAdviceLoading] = useState(false);
  const [postAdviceFromStorage, setPostAdviceFromStorage] = useState(false);

  const fetchResumen = async () => {
    if (!actividadId) return;
    setLoadError(false);
    try {
      const res = await apiRequest<ResumenBackend>(settings.apiBaseUrl, `/actividades/${actividadId}/resumen`, {
        token: user?.token,
      });
      setBackend(res);
    } catch (e: any) {
      setLoadError(true);
    }
  };

  useEffect(() => {
    if (actividadId) void fetchResumen();
  }, [actividadId, settings.apiBaseUrl]);

  const loadPostRouteAdvice = async () => {
    try {
      setPostAdviceLoading(true);
      setPostAdviceFromStorage(false);
      const [clima, stats] = await Promise.all([
        obtenerClimaActual(settings.apiBaseUrl).catch(() => null),
        getTodayAndMonthStats(),
      ]);
      const advice = await requestRouteAdvice({
        kmHoy: Number(stats.dia.km ?? summary.distanciaKm),
        caloriasHoy: Number(stats.dia.calorias ?? summary.calorias),
        kmMes: Number(stats.mes.km ?? summary.distanciaKm),
        rutasMes: Number(stats.mes.rutas ?? 1),
        clima: clima?.condicion ?? 'Sin datos',
        temperatura: clima ? Number(clima.temperaturaC) : null,
        hora: new Date().getHours(),
      });
      setPostAdvice(advice);
    } catch (e: any) {
      setPostAdvice(e?.message ?? 'No se pudo cargar recomendación post-ruta.');
      setPostAdviceFromStorage(false);
    } finally {
      setPostAdviceLoading(false);
    }
  };

  useEffect(() => {
    if (!routeAdvice) {
      (async () => {
        try {
          const saved = await AsyncStorage.getItem(STORAGE_KEYS.lastRouteAdvice);
          if (saved?.trim()) {
            setPostAdvice(saved);
            setPostAdviceFromStorage(true);
          }
        } catch {
          // Ignorar
        }
      })();
    } else {
      setPostAdviceFromStorage(false);
    }
  }, [routeAdvice]);

  useEffect(() => {
    if (!autoOpenEnvironment) return;
    if (autoOpened) return;

    setAutoOpened(true);
    (async () => {
      let lat = summary.endLat;
      let lng = summary.endLng;

      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {
        // si falla, usamos el endLat/endLng
      }

      navigation.replace('EnvironmentalInfo', {
        lat,
        lng,
        useDeviceGps: true,
        autoFetch: true,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenEnvironment, autoOpened]);

  const distancia = backend?.distanciaKm ?? summary.distanciaKm;
  const calorias = backend?.calorias ?? summary.calorias;
  const tiempo = backend?.tiempoSegundos ?? summary.tiempoSegundos;

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.top}>
        <View style={styles.checkCircle}>
          <Text style={styles.check}>✅</Text>
        </View>
        <Text style={styles.h1}>¡Ruta finalizada con éxito!</Text>
        <Text style={styles.sub}>Gran trabajo cuidando el planeta 🌍</Text>
      </View>

      <View style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          <Text style={styles.metricIcon}>📍</Text>
          <Text style={styles.metricValue}>{formatKm(Number(distancia))}</Text>
          <Text style={styles.metricLabel}>Km</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricIcon}>🕐</Text>
          <Text style={styles.metricValue}>{formatHMS(Number(tiempo))}</Text>
          <Text style={styles.metricLabel}>Tiempo</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricIcon}>🔥</Text>
          <Text style={styles.metricValue}>
            {Number.isFinite(Number(calorias)) ? `${Math.round(Number(calorias))}` : '—'}
          </Text>
          <Text style={styles.metricLabel}>Cal</Text>
        </Card>
      </View>

      <Card style={styles.envCard}>
        <Text style={styles.envTitle}>🛡️ Nivel de ruta</Text>
        <Text style={styles.envValue}>{nivelActual ?? '—'}</Text>
        <View style={styles.envRow}>
          <View style={styles.envHalf}>
            <Text style={styles.envLabel}>🌲 Flora</Text>
            <Text style={styles.envCount}>{floraTotal ?? 0} especies</Text>
            {(floraNombres?.length ?? 0) > 0 ? (
              <Text style={styles.envNames} numberOfLines={2}>{floraNombres?.slice(0, 3).join(', ') ?? ''}</Text>
            ) : null}
          </View>
          <View style={styles.envHalf}>
            <Text style={styles.envLabel}>🐦 Fauna</Text>
            <Text style={styles.envCount}>{faunaTotal ?? 0} especies</Text>
            {(faunaNombres?.length ?? 0) > 0 ? (
              <Text style={styles.envNames} numberOfLines={2}>{faunaNombres?.slice(0, 3).join(', ') ?? ''}</Text>
            ) : null}
          </View>
        </View>
      </Card>

      {actividadId && loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>No se pudo cargar el resumen del servidor.</Text>
          <Pressable onPress={() => void fetchResumen()} accessibilityRole="button" style={styles.retryBtn}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      <Card style={styles.postAdviceCard}>
        <Text style={styles.postAdviceTitle}>Recomendación final</Text>
        <Text style={styles.postAdviceText}>
          {postAdviceLoading
            ? 'Analizando clima y esfuerzo para recomendar...'
            : postAdviceFromStorage && postAdvice
              ? `Último consejo disponible:\n\n${postAdvice}`
              : postAdvice || 'Toca "Actualizar recomendación" para obtener un consejo.'}
        </Text>
        <Pressable onPress={() => void loadPostRouteAdvice()} style={styles.retryBtn} accessibilityRole="button">
          <Text style={styles.retryText}>Actualizar recomendación</Text>
        </Pressable>
      </Card>

      <View style={{ flex: 1 }} />

      <LargeButton
        title="🌿 🌱 Conocer el entorno del lugar"
        onPress={() =>
          navigation.navigate('EnvironmentalInfo', {
            lat: summary.endLat,
            lng: summary.endLng,
            useDeviceGps: true,
            autoFetch: true,
          })
        }
        variant="primary"
      />
      <LargeButton
        title="♻️ Ver retos ecológicos"
        onPress={() => navigation.navigate('EcoChallenges', { usuarioId: undefined, rutaId: undefined })}
        variant="outlinePrimary"
      />

      <Pressable
        onPress={() => {
          Alert.alert('Listo', 'Puedes iniciar otra ruta desde el inicio.');
          navigation.popToTop();
        }}
        accessibilityRole="button"
      >
        <Text style={styles.link}>Volver al inicio</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 18, paddingBottom: 24 },
  top: { alignItems: 'center', gap: 8, marginTop: 8 },
  checkCircle: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontSize: 34 },
  h1: { marginTop: 6, fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center', fontFamily },
  sub: { color: colors.muted, fontWeight: '700', textAlign: 'center', fontFamily },

  metricsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  metricCard: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 10 },
  envCard: { marginTop: 12, gap: 8, backgroundColor: '#E8F5E9' },
  envTitle: { color: colors.text, fontWeight: '900', fontFamily },
  envValue: { color: colors.primary, fontWeight: '800', fontFamily },
  envRow: { flexDirection: 'row', gap: 10 },
  envHalf: { flex: 1, gap: 4 },
  envLabel: { color: colors.muted, fontWeight: '800', fontSize: 12, fontFamily },
  envCount: { color: colors.text, fontWeight: '900', fontFamily },
  envNames: { color: colors.muted, fontWeight: '700', fontSize: 11, fontFamily },
  postAdviceCard: { marginTop: 12, gap: 8 },
  postAdviceTitle: { color: colors.text, fontWeight: '900', fontFamily },
  postAdviceText: { color: colors.muted, fontWeight: '700', fontFamily, lineHeight: 20 },
  errorBanner: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  errorText: { color: colors.danger, fontWeight: '700', fontFamily },
  retryBtn: { paddingVertical: 6, paddingHorizontal: 14 },
  retryText: { color: colors.accent, fontWeight: '800', fontFamily },
  metricIcon: { fontSize: 18 },
  metricValue: { color: colors.text, fontWeight: '900', fontFamily },
  metricLabel: { color: colors.muted, fontWeight: '700', fontSize: 12, fontFamily },

  link: {
    marginTop: 12,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    fontFamily,
  },
});


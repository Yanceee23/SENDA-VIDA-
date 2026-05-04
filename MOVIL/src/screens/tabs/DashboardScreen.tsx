import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../state/AuthContext';
import { useHydrationReminders } from '../../state/HydrationRemindersContext';
import { useSettings } from '../../state/SettingsContext';
import { colors } from '../../theme/colors';
import type { AppStackParamList } from '../../types/navigation';
import { fontFamily } from '../../theme/typography';
import { formatHMS, formatKm } from '../../utils/format';
import { LiveMap } from '../../components/LiveMap';
import { useRouteTracking } from '../../state/RouteTrackingContext';
import { Card } from '../../components/Card';
import { LargeButton } from '../../components/LargeButton';
import { MetricCard } from '../../components/MetricCard';
import { obtenerClimaActual, type ClimaActual } from '../../services/climaService';
import { RequireAccountModal } from '../../components/RequireAccountModal';
import { identifyLivingThingFromImage, requestRouteAdvice, type LivingThingIdentification } from '../../services/geminiService';

type AssistantStep = 'menu' | 'routeResult' | 'identifySource' | 'identifyPreview' | 'identifyResult';

type DayStats = {
  km: number;
  calorias: number;
  tiempoSegundos: number;
};

type MonthStats = {
  km: number;
  calorias: number;
  tiempoSegundos: number;
  rutas: number;
};

type RouteAdviceBlock = {
  key: 'tiempo' | 'ruta' | 'intensidad' | 'riesgo' | 'accion';
  label: string;
  icon: string;
  value: string;
};

function parseStatsObject<T extends object>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

function parseRouteAdviceBlocks(response: string): RouteAdviceBlock[] {
  const lines = response
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const map = new Map<RouteAdviceBlock['key'], RouteAdviceBlock>();

  for (const line of lines) {
    const match = line.match(/^(?:\d+\s*[\).\-\:]?\s*)?([^:]+):\s*(.+)$/);
    if (!match) continue;

    const labelRaw = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (!value) continue;

    const isTiempo = labelRaw.includes('tiempo');
    const isRuta = labelRaw.includes('ruta');
    const isIntensidad = labelRaw.includes('intensidad');
    const isRiesgo = labelRaw.includes('riesgo');
    const isAccion = labelRaw.includes('acción') || labelRaw.includes('accion');

    if (isTiempo) {
      map.set('tiempo', { key: 'tiempo', label: 'Tiempo recomendado', icon: '⏱️', value });
    } else if (isRuta) {
      map.set('ruta', { key: 'ruta', label: 'Ruta recomendada', icon: '🧭', value });
    } else if (isIntensidad) {
      map.set('intensidad', { key: 'intensidad', label: 'Intensidad', icon: '⚡', value });
    } else if (isRiesgo) {
      map.set('riesgo', { key: 'riesgo', label: 'Riesgo climático', icon: '🌦️', value });
    } else if (isAccion) {
      map.set('accion', { key: 'accion', label: 'Acción sugerida', icon: '✅', value });
    }
  }

  return ['tiempo', 'ruta', 'intensidad', 'riesgo', 'accion']
    .map((key) => map.get(key as RouteAdviceBlock['key']))
    .filter((item): item is RouteAdviceBlock => Boolean(item));
}

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { status, user } = useAuth();
  const { routeActive, activeRouteProgress } = useHydrationReminders();
  const { settings } = useSettings();
  const [clima, setClima] = useState<ClimaActual | null>(null);
  const [climaLoading, setClimaLoading] = useState(false);
  const [requireModal, setRequireModal] = useState<{ visible: boolean; tipo: 'ciclismo' | 'senderismo' }>({
    visible: false,
    tipo: 'ciclismo',
  });
  const [kmHoy, setKmHoy] = useState(0);
  const [caloriasHoy, setCaloriasHoy] = useState(0);
  const [kmMes, setKmMes] = useState(0);
  const [caloriasMes, setCaloriasMes] = useState(0);
  const [tiempoMesSegundos, setTiempoMesSegundos] = useState(0);
  const [rutasMes, setRutasMes] = useState(0);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [assistantStep, setAssistantStep] = useState<AssistantStep>('menu');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResponse, setAssistantResponse] = useState('');
  const [assistantIdentification, setAssistantIdentification] = useState<LivingThingIdentification | null>(null);
  const [assistantImageUri, setAssistantImageUri] = useState<string | null>(null);
  const [pendingImageBase64, setPendingImageBase64] = useState<{ base64: string; mimeType: string } | null>(null);
  const routeAdviceBlocks = useMemo(() => parseRouteAdviceBlocks(assistantResponse), [assistantResponse]);

  const routeTracking = useRouteTracking();
  const sessionInline = routeTracking.isSessionLive && routeTracking.sessionOrigin === 'dashboard';

  const [finishRouteModalVisible, setFinishRouteModalVisible] = useState(false);

  const goStart = async (tipo: 'ciclismo' | 'senderismo') => {
    if (status !== 'signedIn') {
      setRequireModal({ visible: true, tipo });
      return;
    }
    const ok = await routeTracking.beginSession({ tipo, origin: 'dashboard', saveToDb: true });
    if (!ok) return;
  };

  const routeRegion = useMemo(() => {
    if (!routeTracking.current) return undefined;
    return {
      latitude: routeTracking.current.lat,
      longitude: routeTracking.current.lng,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
  }, [routeTracking.current]);

  const cannotStartAnotherRoute = routeTracking.isSessionLive || routeTracking.initializing;

  const onDashboardFinishPress = () => {
    if (!routeTracking.current) return;
    routeTracking.beginFinishConfirmation();
    setFinishRouteModalVisible(true);
  };

  const onAbandonDashboardRoute = () => {
    Alert.alert('Abandonar ruta', '¿Seguro? No se guardará esta sesión.', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, abandonar', style: 'destructive', onPress: () => routeTracking.cancelSession() },
    ]);
  };

  const cargarClima = async () => {
    try {
      setClimaLoading(true);
      const res = await obtenerClimaActual(settings.apiBaseUrl);
      setClima(res);
    } catch (error: unknown) {
      Alert.alert('Clima no disponible', error instanceof Error ? error.message : 'Error');
    } finally {
      setClimaLoading(false);
    }
  };

  const handleOpenAssistant = () => {
    setAssistantVisible(true);
    setAssistantStep('menu');
    setAssistantResponse('');
    setAssistantIdentification(null);
    setAssistantImageUri(null);
    setPendingImageBase64(null);
  };

  const handleCloseAssistant = () => {
    if (assistantLoading) return;
    setAssistantVisible(false);
    setAssistantStep('menu');
    setAssistantResponse('');
    setAssistantIdentification(null);
    setAssistantImageUri(null);
    setPendingImageBase64(null);
  };

  const getAssistantStats = async () => {
    const now = new Date();
    const diaKey = now.toISOString().split('T')[0];
    const mesKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [rawDia, rawMes] = await Promise.all([
      AsyncStorage.getItem(`stats_dia_${diaKey}`),
      AsyncStorage.getItem(`stats_mes_${mesKey}`),
    ]);
    const dayStats = parseStatsObject<DayStats>(rawDia, { km: 0, calorias: 0, tiempoSegundos: 0 });
    const monthStats = parseStatsObject<MonthStats>(rawMes, { km: 0, calorias: 0, tiempoSegundos: 0, rutas: 0 });

    return {
      kmHoy: Number(dayStats.km ?? 0),
      caloriasHoy: Number(dayStats.calorias ?? 0),
      kmMes: Number(monthStats.km ?? 0),
      rutasMes: Number(monthStats.rutas ?? 0),
      hora: now.getHours(),
    };
  };

  const handleRouteAdvice = async () => {
    setAssistantStep('routeResult');
    setAssistantResponse('');
    setAssistantIdentification(null);
    setAssistantLoading(true);
    try {
      const stats = await getAssistantStats();
      const advice = await requestRouteAdvice({
        kmHoy: stats.kmHoy,
        caloriasHoy: stats.caloriasHoy,
        kmMes: stats.kmMes,
        rutasMes: stats.rutasMes,
        clima: clima?.condicion ?? 'Sin datos',
        temperatura: clima ? Math.round(clima.temperaturaC) : null,
        hora: stats.hora,
        actividad: 'actividad',
        nombreUsuario: user?.nombre,
      });
      setAssistantResponse(advice);
    } catch (error: unknown) {
      console.error('[Assistant] Error en consejos de ruta', { error });
      const message = error instanceof Error ? error.message : 'Servicio temporalmente no disponible, intenta más tarde.';
      setAssistantResponse(message);
    } finally {
      setAssistantLoading(false);
    }
  };

  const handlePickImage = async (source: 'camera' | 'gallery') => {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Necesito permiso de cámara para continuar.');
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Necesito permiso de galería para continuar.');
        }
      }

      const pickerResult =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            });

      if (pickerResult.canceled || !pickerResult.assets?.length) {
        return;
      }

      const asset = pickerResult.assets[0];
      setAssistantImageUri(asset.uri);

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setPendingImageBase64({ base64, mimeType: asset.mimeType ?? 'image/jpeg' });
      setAssistantStep('identifyPreview');
    } catch (error: unknown) {
      console.error('[Assistant] Error al seleccionar imagen', { error, source });
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo obtener la imagen.');
    }
  };

  const handleAnalizar = async () => {
    if (!pendingImageBase64) return;
    setAssistantStep('identifyResult');
    setAssistantResponse('');
    setAssistantIdentification(null);
    setAssistantLoading(true);
    try {
      const response = await identifyLivingThingFromImage({
        base64: pendingImageBase64.base64,
        mimeType: pendingImageBase64.mimeType,
      });
      setAssistantIdentification(response);
      setAssistantResponse(response.rawText);
      setPendingImageBase64(null);
    } catch (error: unknown) {
      console.error('[Assistant] Error en identificación', { error });
      const message = error instanceof Error ? error.message : 'No se pudo identificar.';
      setAssistantResponse(message);
    } finally {
      setAssistantLoading(false);
    }
  };

  useEffect(() => {
    void cargarClima();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      const cargarStats = async () => {
        try {
          const now = new Date();
          const diaKey = now.toISOString().split('T')[0];
          const mesKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

          const [rawDia, rawMes] = await Promise.all([AsyncStorage.getItem(`stats_dia_${diaKey}`), AsyncStorage.getItem(`stats_mes_${mesKey}`)]);
          const statsDia: { km: number; calorias: number; tiempoSegundos: number } = rawDia
            ? JSON.parse(rawDia)
            : { km: 0, calorias: 0, tiempoSegundos: 0 };
          const statsMes: { km: number; calorias: number; tiempoSegundos: number; rutas: number } = rawMes
            ? JSON.parse(rawMes)
            : { km: 0, calorias: 0, tiempoSegundos: 0, rutas: 0 };

          setKmHoy(Number(statsDia.km ?? 0));
          setCaloriasHoy(Number(statsDia.calorias ?? 0));
          setKmMes(Number(statsMes.km ?? 0));
          setCaloriasMes(Number(statsMes.calorias ?? 0));
          setTiempoMesSegundos(Number(statsMes.tiempoSegundos ?? 0));
          setRutasMes(Number(statsMes.rutas ?? 0));
        } catch (error: unknown) {
          setKmHoy(0);
          setCaloriasHoy(0);
          setKmMes(0);
          setCaloriasMes(0);
          setTiempoMesSegundos(0);
          setRutasMes(0);
          Alert.alert('Inicio', error instanceof Error ? error.message : 'No se pudieron cargar tus estadísticas.');
        }
      };
      void cargarStats();
    }, [])
  );

  const kmHoyEnVivo = routeActive ? kmHoy + Number(activeRouteProgress.distanciaKm ?? 0) : kmHoy;
  const caloriasHoyEnVivo = routeActive ? caloriasHoy + Number(activeRouteProgress.calorias ?? 0) : caloriasHoy;

  return (
    <Screen scroll contentStyle={styles.screen}>
      <RequireAccountModal
        visible={requireModal.visible}
        onClose={() => setRequireModal((p) => ({ ...p, visible: false }))}
        onCreateAccount={() => {
          setRequireModal((p) => ({ ...p, visible: false }));
          navigation.navigate('Register');
        }}
      />
      <Modal
        visible={assistantVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseAssistant}
      >
        <Pressable
          style={styles.backdrop}
          onPress={handleCloseAssistant}
          disabled={assistantLoading}
          accessibilityRole="button"
          accessibilityLabel="Cerrar asistente"
        >
          <View />
        </Pressable>
        <View style={styles.assistantCenter}>
          <Card style={styles.assistantCard}>
            {assistantLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>🤖 SENDA está analizando...</Text>
              </View>
            ) : null}

            {!assistantLoading && assistantStep === 'menu' ? (
              <>
                <Text style={styles.assistantTitle}>🤖 Soy SENDA, tu asistente</Text>
                <Text style={styles.assistantSubtitle}>¿En qué te puedo ayudar hoy?</Text>
                <View style={styles.assistantButtons}>
                  <LargeButton title="🏃 Consejos de Ruta" onPress={() => void handleRouteAdvice()} variant="primary" />
                  <LargeButton
                    title="🔍 Identificar planta o animal"
                    onPress={() => setAssistantStep('identifySource')}
                    variant="outlinePrimary"
                  />
                </View>
                <Pressable onPress={handleCloseAssistant} style={styles.closeLink} accessibilityRole="button">
                  <Text style={styles.closeText}>Cerrar</Text>
                </Pressable>
              </>
            ) : null}

            {!assistantLoading && assistantStep === 'identifySource' ? (
              <>
                <Text style={styles.assistantTitle}>🤖 Soy SENDA, tu asistente</Text>
                <Text style={styles.assistantSubtitle}>Elige una opción para identificar</Text>
                <View style={styles.assistantButtons}>
                  <LargeButton title="📷 Tomar foto" onPress={() => void handlePickImage('camera')} variant="primary" />
                  <LargeButton title="🖼️ Galería" onPress={() => void handlePickImage('gallery')} variant="outlinePrimary" />
                </View>
                <Pressable onPress={handleCloseAssistant} style={styles.closeLink} accessibilityRole="button">
                  <Text style={styles.closeText}>Cerrar</Text>
                </Pressable>
              </>
            ) : null}

            {!assistantLoading && assistantStep === 'identifyPreview' ? (
              <>
                <Text style={styles.assistantTitle}>🔍 Vista previa</Text>
                <Text style={styles.assistantSubtitle}>Toca Analizar para identificar la planta o animal</Text>
                {assistantImageUri ? <Image source={{ uri: assistantImageUri }} style={styles.previewImage} /> : null}
                <View style={styles.assistantButtons}>
                  <LargeButton title="🔬 Analizar" onPress={() => void handleAnalizar()} variant="primary" />
                  <LargeButton title="Elegir otra foto" onPress={() => { setAssistantImageUri(null); setPendingImageBase64(null); setAssistantStep('identifySource'); }} variant="outlinePrimary" />
                </View>
                <Pressable onPress={handleCloseAssistant} style={styles.closeLink} accessibilityRole="button">
                  <Text style={styles.closeText}>Cerrar</Text>
                </Pressable>
              </>
            ) : null}

            {!assistantLoading && assistantStep === 'routeResult' ? (
              <>
                <Text style={styles.assistantTitle}>🏃 Consejos de Ruta</Text>
                <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent}>
                  {routeAdviceBlocks.length > 0 ? (
                    <View style={styles.routeAdviceBlocks}>
                      {routeAdviceBlocks.map((block) => (
                        <View key={block.key} style={styles.routeAdviceBlock}>
                          <Text style={styles.routeAdviceLabel}>
                            {block.icon} {block.label}
                          </Text>
                          <Text style={styles.routeAdviceValue}>{block.value}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.resultText}>{assistantResponse || 'No se pudo obtener respuesta.'}</Text>
                  )}
                </ScrollView>
                <Pressable onPress={handleCloseAssistant} style={styles.closeLink} accessibilityRole="button">
                  <Text style={styles.closeText}>Cerrar</Text>
                </Pressable>
              </>
            ) : null}

            {!assistantLoading && assistantStep === 'identifyResult' ? (
              <>
                <Text style={styles.assistantTitle}>🔍 Resultado de identificación</Text>
                <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent}>
                  {assistantImageUri ? <Image source={{ uri: assistantImageUri }} style={styles.previewImage} /> : null}
                  <Text style={styles.identifyName}>{assistantIdentification?.nombreComun ?? 'Sin identificar'}</Text>
                  <Text style={styles.identifyScientific}>{assistantIdentification?.nombreCientifico ?? 'No disponible'}</Text>
                  <Text style={styles.identifyMeta}>
                    <Text style={{ fontWeight: '900', color: colors.text }}>Categoría: </Text>
                    <Text>{assistantIdentification?.categoria ?? 'desconocido'}</Text>
                  </Text>
                  <Text style={styles.identifyMeta}>
                    <Text style={{ fontWeight: '900', color: colors.text }}>Tipo / grupo: </Text>
                    <Text>{assistantIdentification?.tipoEspecifico ?? 'No disponible'}</Text>
                  </Text>
                  <Text style={styles.identifyMeta}>
                    <Text style={{ fontWeight: '900', color: colors.text }}>Descripción: </Text>
                    <Text>{assistantIdentification?.descripcion ?? 'No disponible'}</Text>
                  </Text>
                  <Text style={styles.identifyMeta}>
                    <Text style={{ fontWeight: '900', color: colors.text }}>Distribución habitual: </Text>
                    <Text>{assistantIdentification?.distribucion ?? 'No disponible'}</Text>
                  </Text>
                  <Text style={styles.identifyMeta}>
                    <Text style={{ fontWeight: '900', color: colors.text }}>Hábitat: </Text>
                    <Text>{assistantIdentification?.habitat ?? 'No disponible'}</Text>
                  </Text>
                  {assistantIdentification?.recomendacionUsuario ? (
                    <View style={styles.funFactCard}>
                      <Text style={styles.funFactTitle}>💡 Dato curioso</Text>
                      <Text style={styles.funFactText}>{assistantIdentification.recomendacionUsuario}</Text>
                    </View>
                  ) : null}
                </ScrollView>
                <Pressable onPress={handleCloseAssistant} style={styles.closeLink} accessibilityRole="button">
                  <Text style={styles.closeText}>Cerrar</Text>
                </Pressable>
              </>
            ) : null}
          </Card>
        </View>
      </Modal>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          style={styles.menuBtn}
          accessibilityRole="button"
          accessibilityLabel="Abrir menú"
        >
          <Text style={styles.menuIcon}>≡</Text>
        </Pressable>
        <Text style={styles.headerTitle}>SENDA VIDA</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate('WeatherAlerts', { lat: 0, lng: 0 })}
            style={styles.weatherBtn}
            accessibilityRole="button"
            accessibilityLabel="Ver clima"
          >
            <Text style={styles.weatherIcon}>⛅</Text>
          </Pressable>
          <Pressable onPress={handleOpenAssistant} style={styles.weatherBtn} accessibilityRole="button" accessibilityLabel="Abrir asistente SENDA">
            <MaterialCommunityIcons name="robot" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <Card style={styles.weatherCard}>
        <View style={styles.weatherTop}>
          <Text style={styles.weatherTitle}>Clima</Text>
          <Pressable onPress={cargarClima} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Actualizar clima">
            <Text style={styles.refresh}>↻</Text>
          </Pressable>
        </View>
        {clima ? (
          <View style={{ gap: 4 }}>
            <Text style={styles.weatherNow}>
              {clima.icono} {Math.round(clima.temperaturaC)}°C • {clima.condicion}
            </Text>
            <Text style={styles.weatherSub}>
              {status === 'signedIn' ? `Hola, ${user?.nombre ?? ''}` : 'Modo invitado'}
            </Text>
          </View>
        ) : (
          <Text style={styles.weatherSub}>{climaLoading ? 'Cargando…' : 'Disponible al activar GPS'}</Text>
        )}
      </Card>

      {routeTracking.initializing && !sessionInline ? (
        <Card style={styles.preparingCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.preparingText}>Preparando GPS y ruta…</Text>
        </Card>
      ) : null}

      {sessionInline ? (
        <Card style={styles.liveRouteCard}>
          <Text style={styles.liveRouteTitle}>{routeTracking.routeTitle}</Text>
          <Text style={styles.liveRouteHint}>Mapa en vivo · los km suman mientras te mueves</Text>
          <View style={styles.precisionWrap}>
            <Text style={styles.precisionLabel}>GPS:</Text>
            <Pressable
              onPress={() => void routeTracking.setGpsPrecisionMode('normal')}
              style={[styles.precisionChip, routeTracking.gpsPrecisionMode === 'normal' && styles.precisionChipActive]}
              accessibilityRole="button"
            >
              <Text
                style={[styles.precisionChipText, routeTracking.gpsPrecisionMode === 'normal' && styles.precisionChipTextActive]}
              >
                Normal
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void routeTracking.setGpsPrecisionMode('high')}
              style={[styles.precisionChip, routeTracking.gpsPrecisionMode === 'high' && styles.precisionChipActive]}
              accessibilityRole="button"
            >
              <Text
                style={[styles.precisionChipText, routeTracking.gpsPrecisionMode === 'high' && styles.precisionChipTextActive]}
              >
                Alta precisión
              </Text>
            </Pressable>
          </View>
          <View style={styles.liveMapBox}>
            <LiveMap
              region={routeRegion}
              points={routeTracking.points}
              current={routeTracking.current}
              startPoint={routeTracking.startPoint}
              destination={routeTracking.destination}
              plannedRoutePoints={routeTracking.plannedRoutePoints}
              finalPoint={routeTracking.finishPoint}
              heading={routeTracking.heading}
              followUserLocation
              permissionOk={routeTracking.permissionGranted}
              interactionMode="follow_zoom"
            />
          </View>
          <View style={styles.liveStatsRow}>
            <Text style={styles.liveStat} accessibilityLabel={`Distancia ${formatKm(routeTracking.distKm)}`}>
              📍 {formatKm(routeTracking.distKm)}
            </Text>
            <Text style={styles.liveStat}>🕐 {formatHMS(routeTracking.elapsedSec)}</Text>
            <Text style={styles.liveStat}>🔥 {routeTracking.calorias} kcal</Text>
          </View>
          <LargeButton
            title={routeTracking.paused ? '▶ Reanudar' : '⏸ Pausar'}
            onPress={() => void routeTracking.togglePause()}
            variant="neutral"
            disabled={routeTracking.finishing}
          />
          <LargeButton
            title={routeTracking.finishing ? 'Procesando…' : '🏁 Finalizar ruta'}
            onPress={onDashboardFinishPress}
            variant="primary"
            disabled={routeTracking.finishing}
          />
          <Pressable onPress={onAbandonDashboardRoute} style={styles.abandonLink} accessibilityRole="button">
            <Text style={styles.abandonLinkText}>Abandonar sin guardar</Text>
          </Pressable>
        </Card>
      ) : null}

      <Modal visible={finishRouteModalVisible} transparent animationType="fade" onRequestClose={() => {
        setFinishRouteModalVisible(false);
        void routeTracking.abortFinishConfirmation();
      }}>
        <View style={styles.finishModalBackdrop}>
          <View style={styles.finishModalCard}>
            <Text style={styles.finishModalTitle}>¿Finalizar ruta?</Text>
            <Text style={styles.finishModalSub}>Distancia: {formatKm(routeTracking.distKm)}</Text>
            <Text style={styles.finishModalSub}>Tiempo: {formatHMS(routeTracking.elapsedSec)}</Text>
            <Text style={styles.finishModalSub}>Calorías: {routeTracking.calorias} kcal</Text>
            <LargeButton
              title={routeTracking.finishing ? 'Guardando…' : 'Finalizar y guardar'}
              onPress={() => {
                setFinishRouteModalVisible(false);
                void routeTracking.completeFinalize();
              }}
              variant="primary"
              disabled={routeTracking.finishing}
            />
            <LargeButton
              title="Seguir caminando"
              onPress={() => {
                setFinishRouteModalVisible(false);
                void routeTracking.abortFinishConfirmation();
              }}
              variant="outlinePrimary"
              disabled={routeTracking.finishing}
            />
          </View>
        </View>
      </Modal>

      <View style={styles.metricsRow}>
        <MetricCard icon="📍" value={kmHoyEnVivo.toFixed(2)} label={routeActive ? 'Km hoy (en vivo)' : 'Km hoy'} />
        <MetricCard icon="🔥" value={`${Math.round(caloriasHoyEnVivo)}`} label="Calorías hoy" />
      </View>
      <View style={styles.metricsRow}>
        <MetricCard icon="🗓️" value={kmMes.toFixed(2)} label="Km este mes" />
        <MetricCard icon="🔥" value={`${Math.round(caloriasMes)}`} label="Calorías este mes" />
      </View>
      <View style={styles.metricsRow}>
        <MetricCard icon="🕐" value={formatHMS(tiempoMesSegundos)} label="Tiempo este mes" />
        <MetricCard icon="🧭" value={`${Math.round(rutasMes)}`} label="Rutas este mes" />
      </View>

      <LargeButton
        title="Iniciar ruta en bici"
        onPress={() => void goStart('ciclismo')}
        variant="primary"
        left={<Text style={styles.bigEmoji}>🚴</Text>}
        disabled={cannotStartAnotherRoute}
      />
      <LargeButton
        title="Iniciar caminata"
        onPress={() => void goStart('senderismo')}
        variant="brown"
        left={<Text style={styles.bigEmoji}>🥾</Text>}
        disabled={cannotStartAnotherRoute}
      />
      <LargeButton
        title="Ir a un lugar"
        onPress={() => navigation.navigate('NavigateToPlace')}
        variant="outlinePrimary"
        left={<Text style={styles.bigEmoji}>🧭</Text>}
      />

      <View style={styles.exploreHeader}>
        <Text style={styles.sectionTitle}>Explorar</Text>
        <Pressable onPress={() => navigation.navigate('SafeRoutes')} accessibilityRole="button">
          <Text style={styles.seeAll}>Ver todo &gt;</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exploreScroll}>
        {exploreItems.map((it) => (
          <Pressable key={it.key} onPress={() => navigation.navigate('SafeRoutes')} style={{ width: 120 }}>
            <Card style={styles.exploreCard}>
              <Text style={styles.exploreIcon}>{it.icon}</Text>
              <Text style={styles.exploreText}>{it.label}</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const exploreItems = [
  { key: 'volcanes', icon: '🌋', label: 'Volcanes' },
  { key: 'montanas', icon: '⛰️', label: 'Montañas' },
  { key: 'parques', icon: '🌳', label: 'Parques' },
  { key: 'rios', icon: '💧', label: 'Ríos' },
  { key: 'playas', icon: '🏖️', label: 'Playas' },
];

const styles = StyleSheet.create({
  screen: { paddingTop: 14 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  assistantCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  assistantCard: { width: '100%', maxWidth: 420, gap: 12, maxHeight: '82%' },
  assistantTitle: { color: colors.text, fontWeight: '900', fontFamily, textAlign: 'center', fontSize: 18 },
  assistantSubtitle: { color: colors.muted, fontWeight: '600', fontFamily, textAlign: 'center' },
  assistantButtons: { gap: 10 },
  closeLink: { paddingTop: 4 },
  closeText: { color: colors.muted, textAlign: 'center', fontFamily, fontWeight: '700' },
  loadingWrap: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { color: colors.muted, fontWeight: '700', fontFamily, textAlign: 'center' },
  resultScroll: { maxHeight: 360 },
  resultContent: { gap: 10, paddingVertical: 4 },
  resultText: { color: colors.text, fontWeight: '600', fontFamily, lineHeight: 22 },
  routeAdviceBlocks: { gap: 10 },
  routeAdviceBlock: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D8E2EA',
    backgroundColor: '#F7FAFC',
    gap: 4,
  },
  routeAdviceLabel: { color: colors.muted, fontWeight: '800', fontFamily },
  routeAdviceValue: { color: colors.text, fontWeight: '700', fontFamily, lineHeight: 20 },
  previewImage: { width: 150, height: 150, borderRadius: 16, alignSelf: 'center' },
  identifyName: { color: colors.text, fontWeight: '900', fontFamily, fontSize: 22, textAlign: 'center' },
  identifyScientific: { color: colors.muted, fontWeight: '600', fontFamily, fontStyle: 'italic', textAlign: 'center' },
  identifyMeta: { color: colors.text, fontWeight: '700', fontFamily, lineHeight: 20 },
  identifyDescription: { color: colors.text, fontWeight: '600', fontFamily, lineHeight: 22 },
  identifyRaw: { color: colors.muted, fontWeight: '500', fontFamily, lineHeight: 20 },
  funFactCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  funFactTitle: { color: colors.surface, fontWeight: '900', fontFamily },
  funFactText: { color: colors.surface, fontWeight: '600', fontFamily, lineHeight: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 28, color: colors.text, fontFamily, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text, fontFamily, letterSpacing: 0.2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#E8F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherIcon: { fontSize: 18 },

  weatherCard: { backgroundColor: '#E8F5F9' },
  weatherTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weatherTitle: { color: colors.muted, fontWeight: '800', fontFamily },
  refresh: { color: colors.muted, fontSize: 16, fontFamily, fontWeight: '800' },
  weatherNow: { color: colors.text, fontSize: 18, fontWeight: '900', fontFamily },
  weatherSub: { color: colors.muted, fontSize: 14, fontWeight: '600', fontFamily },

  preparingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  preparingText: { color: colors.muted, fontWeight: '700', fontFamily, flex: 1 },

  liveRouteCard: { gap: 10, overflow: 'hidden' },
  liveRouteTitle: { color: colors.text, fontWeight: '900', fontFamily, fontSize: 16 },
  liveRouteHint: { color: colors.muted, fontWeight: '600', fontFamily, fontSize: 12 },
  precisionWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  precisionLabel: { color: colors.muted, fontWeight: '800', fontFamily, fontSize: 12 },
  precisionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  precisionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  precisionChipText: { color: colors.muted, fontWeight: '800', fontFamily, fontSize: 12 },
  precisionChipTextActive: { color: colors.primary, fontWeight: '900' },
  liveMapBox: { height: 240, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1C2B2A' },
  liveStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  liveStat: { color: colors.text, fontWeight: '800', fontFamily, fontSize: 13 },

  abandonLink: { paddingVertical: 8, alignItems: 'center' },
  abandonLinkText: { color: colors.muted, fontWeight: '700', fontFamily, fontSize: 13 },

  finishModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  finishModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  finishModalTitle: { color: colors.text, fontWeight: '900', fontFamily, fontSize: 17, textAlign: 'center' },
  finishModalSub: { color: colors.muted, fontWeight: '700', fontFamily, textAlign: 'center' },

  metricsRow: { flexDirection: 'row', gap: 12 },

  bigEmoji: { fontSize: 18 },

  exploreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.text, fontFamily },
  seeAll: { color: colors.muted, fontWeight: '800', fontFamily },

  exploreScroll: { gap: 12, paddingVertical: 6 },
  exploreCard: { alignItems: 'center', justifyContent: 'center', gap: 6, height: 88 },
  exploreIcon: { fontSize: 26 },
  exploreText: { color: colors.text, fontWeight: '800', fontFamily },
});


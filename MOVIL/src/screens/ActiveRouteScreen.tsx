import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { LargeButton } from '../components/LargeButton';
import { LiveMap } from '../components/LiveMap';
import { useGPS, type GPSPoint } from '../hooks/useGPS';
import { getOsrmRoute } from '../services/osrmService';
import { addTodayStats, syncStatsToBackend } from '../services/statsService';
import { detectExtremeWeather } from '../services/weatherAlertsService';
import { apiRequest, toQuery } from '../services/api';
import { requestRouteAdvice } from '../services/geminiService';
import { STORAGE_KEYS } from '../config';
import { useAuth } from '../state/AuthContext';
import { useHydrationReminders } from '../state/HydrationRemindersContext';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import type { AppStackParamList } from '../types/navigation';
import { formatHMS, formatKm } from '../utils/format';
import { haversine } from '../utils/geo';

type Props = NativeStackScreenProps<AppStackParamList, 'ActiveRoute'>;

type ContactOption = {
  id: string;
  nombre: string;
  numero: string;
};

type ActivityStartResponse = { id: number };

const EMERGENCIAS = [
  { nombre: '🚔 Policía Nacional Civil', numero: '911' },
  { nombre: '🚑 Sistema de Emergencias Médicas (SEM)', numero: '132' },
  { nombre: '🔴 Cruz Roja Salvadoreña', numero: '22225155' },
  { nombre: '🟢 Cruz Verde', numero: '22845792' },
  { nombre: '🆘 Comandos de Salvamento', numero: '21330000' },
  { nombre: '🛡️ Protección Civil', numero: '22810888' },
] as const;

function cleanPhoneNumber(raw: string): string {
  return raw.replace(/\D+/g, '');
}

function normalizarNumero(raw: string): string {
  return raw.replace(/[\s\-\(\)\+]/g, '');
}

export function ActiveRouteScreen({ navigation, route }: Props) {
  const { settings } = useSettings();
  const { status, user, requireUserId } = useAuth();
  const { setRouteActive, schedulePostRouteIfEnabled, notifyExtremeWeather } = useHydrationReminders();
  const gps = useGPS();

  const tipo = route.params?.tipo ?? 'senderismo';
  const mode = tipo === 'ciclismo' ? 'bike' : 'foot';
  const saveToDb = status === 'signedIn' && route.params?.saveToDb !== false;
  const destination =
    Number.isFinite(Number(route.params?.destLat)) && Number.isFinite(Number(route.params?.destLng))
      ? { lat: Number(route.params?.destLat), lng: Number(route.params?.destLng) }
      : null;

  const [current, setCurrent] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [points, setPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [plannedRoutePoints, setPlannedRoutePoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [plannedDurationMin, setPlannedDurationMin] = useState<number | null>(null);
  const [distKm, setDistKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [activityId, setActivityId] = useState<number | null>(null);
  const [finishPoint, setFinishPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [contactsVisible, setContactsVisible] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsQuery, setContactsQuery] = useState('');
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [routeAdvice, setRouteAdvice] = useState('');
  const [routeAdviceLoading, setRouteAdviceLoading] = useState(false);
  const [adviceIsFromStorage, setAdviceIsFromStorage] = useState(false);
  const [robotModalVisible, setRobotModalVisible] = useState(false);
  const [lastKnownClimate, setLastKnownClimate] = useState<{ condicion: string; temperaturaC: number | null }>({
    condicion: 'Sin datos',
    temperaturaC: null,
  });

  const calorias = useMemo(() => {
    const factor = tipo === 'ciclismo' ? 30 : 60;
    return distKm * factor;
  }, [distKm, tipo]);

  const region = useMemo(() => {
    if (!current) return undefined;
    return {
      latitude: current.lat,
      longitude: current.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [current]);

  const updateTimer = (startTs: number) => {
    const now = Date.now();
    setElapsedSec(Math.max(0, Math.floor((now - startTs) / 1000)));
  };

  const refreshRouteAdvice = async (overrideClimate?: { condicion?: string; temperaturaC?: number | null }) => {
    try {
      setRouteAdviceLoading(true);
      setAdviceIsFromStorage(false);
      const climaCondicion = String(overrideClimate?.condicion ?? lastKnownClimate.condicion ?? 'Sin datos');
      const temperatura = overrideClimate?.temperaturaC ?? lastKnownClimate.temperaturaC;
      const recommendation = await requestRouteAdvice({
        kmHoy: distKm,
        caloriasHoy: calorias,
        rutasMes: 1,
        kmMes: distKm,
        clima: climaCondicion,
        temperatura,
        hora: new Date().getHours(),
      });
      setRouteAdvice(recommendation);
    } catch (e: any) {
      setRouteAdvice(e?.message ?? 'Servicio temporalmente no disponible, intenta más tarde.');
      setAdviceIsFromStorage(false);
    } finally {
      setRouteAdviceLoading(false);
    }
  };

  const onGpsUpdate = (point: GPSPoint) => {
    if (paused) return;
    const next = { lat: point.lat, lng: point.lng };
    setHeading(point.heading);
    setCurrent(next);
    setPoints((prev) => {
      if (!prev.length) return [next];
      const last = prev[prev.length - 1];
      const delta = haversine(last.lat, last.lng, next.lat, next.lng);
      if (delta >= 0.01) {
        setDistKm((d) => d + delta);
        return [...prev, next];
      }
      return prev;
    });
    if (startedAt) updateTimer(startedAt);
  };

  const buildEmergencyMessage = async (): Promise<string | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('GPS', 'Activa el GPS para compartir tu ubicación.');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;
      const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
      const mensaje =
        '🚨 EMERGENCIA - Necesito ayuda.\n' +
        '📍 Mi ubicación actual:\n' +
        `${mapsLink}\n` +
        'Abre el link para ver dónde estoy.';
      return mensaje;
    } catch {
      Alert.alert('GPS', 'No se pudo obtener tu ubicación actual.');
      return null;
    }
  };

  const sendLocationByWhatsApp = async () => {
    try {
      setSafetyLoading(true);
      const mensaje = await buildEmergencyMessage();
      if (!mensaje) return;
      const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert('Seguridad', 'No se pudo abrir WhatsApp.');
    } finally {
      setSafetyLoading(false);
    }
  };

  const sendLocationToContactWhatsApp = async (contact: ContactOption) => {
    const numeroLimpio = cleanPhoneNumber(contact.numero);
    if (!numeroLimpio) {
      Alert.alert('Contacto', 'Este contacto no tiene número.');
      return;
    }
    try {
      setSafetyLoading(true);
      const mensaje = await buildEmergencyMessage();
      if (!mensaje) return;
      const url = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp para este contacto.');
    } finally {
      setSafetyLoading(false);
    }
  };

  const callEmergency = async (numero: string) => {
    try {
      await Linking.openURL(`tel:${numero}`);
    } catch {
      Alert.alert('Llamada', 'No se pudo iniciar la llamada de emergencia.');
    }
  };

  const loadContacts = async () => {
    try {
      setContactsLoading(true);
      setContactsVisible(true);
      setContactsQuery('');
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a contactos.');
        setContacts([]);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.FirstName, Contacts.Fields.LastName, Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      const list: ContactOption[] = data
        .filter((c) => {
          const nombre = (c.name || c.firstName || c.lastName || '').trim();
          return nombre.length > 0 && c.phoneNumbers && c.phoneNumbers.length > 0;
        })
        .map((c) => ({
          id: String(c.id),
          nombre: (c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sin nombre').trim(),
          numero: normalizarNumero(String(c.phoneNumbers?.[0]?.number ?? '')),
        }))
        .filter((c) => c.numero.trim().length > 0)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      setContacts(list);
    } catch {
      Alert.alert('Contactos', 'No se pudieron cargar contactos.');
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const initRoute = async () => {
    try {
      setLoading(true);
      setRouteActive(true);

      const baseUrl = (settings.apiBaseUrl ?? '').trim();
      const weather = baseUrl ? await detectExtremeWeather(baseUrl) : { shouldAlert: false, message: '', clima: null };
      const climaActual = {
        condicion: weather.clima?.condicion ?? 'Sin datos',
        temperaturaC: weather.clima ? Number(weather.clima.temperaturaC) : null,
      };
      setLastKnownClimate(climaActual);
      if (weather.shouldAlert) {
        await notifyExtremeWeather(weather.message);
      }

      const initial = await gps.getCurrent();
      if (!initial) {
        Alert.alert('GPS', gps.error ?? 'No se pudo obtener ubicación.');
        navigation.goBack();
        return;
      }

      const start = { lat: initial.lat, lng: initial.lng };
      setCurrent(start);
      setHeading(initial.heading);
      setPoints([start]);
      const startTs = Date.now();
      setStartedAt(startTs);
      setElapsedSec(0);

      if (destination) {
        try {
          const routeData = await getOsrmRoute({
            mode,
            startLat: start.lat,
            startLng: start.lng,
            endLat: destination.lat,
            endLng: destination.lng,
          });
          setPlannedRoutePoints(routeData.geometry);
          setPlannedDurationMin(routeData.durationMin);
        } catch (e: any) {
          setPlannedRoutePoints([]);
          setPlannedDurationMin(null);
          Alert.alert('Ruta', e?.message ?? 'No se pudo calcular la ruta.');
        }
      }

      if (saveToDb && baseUrl) {
        const usuarioId = requireUserId();
        const act = await apiRequest<ActivityStartResponse>(
          baseUrl,
          `/actividades/iniciar?usuarioId=${usuarioId}&rutaId=${route.params?.rutaId ?? ''}&tipo=${tipo}`,
          { method: 'POST' }
        );
        setActivityId(Number(act.id));
      }

      const ok = await gps.startTracking(onGpsUpdate);
      if (!ok) {
        Alert.alert('GPS', gps.error ?? 'No se pudo iniciar seguimiento.');
      }
    } catch (e: any) {
      Alert.alert('Ruta', e?.message ?? 'No se pudo iniciar la ruta.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.lastRouteAdvice);
        if (saved?.trim()) {
          setRouteAdvice(saved);
          setAdviceIsFromStorage(true);
        }
      } catch {
        // Ignorar
      }
    })();
  }, []);

  React.useEffect(() => {
    void initRoute();
    return () => {
      gps.stopTracking();
      setRouteActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!startedAt || paused) return;
    const id = setInterval(() => updateTimer(startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt, paused]);

  const onTogglePause = async () => {
    const nextPaused = !paused;
    setPaused(nextPaused);
    if (nextPaused) {
      gps.stopTracking();
      return;
    }
    await gps.startTracking(onGpsUpdate);
  };

  const onFinishPress = () => {
    if (!current) return;
    gps.stopTracking();
    setFinishPoint(current);
    setShowFinishModal(true);
  };

  const finalizeRoute = async () => {
    try {
      setLoading(true);
      setShowFinishModal(false);
      const baseUrl = (settings.apiBaseUrl ?? '').trim();
      if (saveToDb && activityId && baseUrl) {
        await apiRequest(baseUrl, `/actividades/${activityId}/finalizar`, { method: 'PUT' });
      }

      const today = new Date();
      try {
        await addTodayStats(distKm, calorias, elapsedSec, today);
      } catch {
        Alert.alert('Estadísticas', 'No se pudieron guardar los datos del día. Se intentará en la próxima ruta.');
      }
      if (saveToDb && user?.userId && baseUrl) {
        try {
          await syncStatsToBackend(baseUrl, {
            userId: user.userId,
            fecha: today.toISOString().split('T')[0],
            distanciaKm: distKm,
            calorias,
            tipo,
          });
        } catch {
          Alert.alert('Sincronización', 'No se pudo sincronizar al servidor, pero tu ruta sí se guardó en el celular.');
        }
      }

      await schedulePostRouteIfEnabled();
      setRouteActive(false);

      const nivelActual = route.params?.nivelSeguridad ?? '—';
      let floraTotal = 0;
      let faunaTotal = 0;
      let floraNombres: string[] = [];
      let faunaNombres: string[] = [];

      if (current) {
        let envRes: { especies?: { flora?: { nombre?: string }[]; floraTotal?: number; fauna?: { nombre?: string }[]; faunaTotal?: number } } | null = null;
        if (baseUrl) {
          const explorerPromise = apiRequest<typeof envRes>(
            baseUrl,
            `/explorer/explorar${toQuery({ lat: current.lat, lng: current.lng, nombre: route.params?.destNombre ?? 'Lugar visitado', tipo: 'parque' })}`,
            { method: 'POST', timeoutMs: 6000 }
          );
          const timeoutPromise = new Promise<null>((res) => setTimeout(() => res(null), 5000));
          envRes = await Promise.race([explorerPromise.catch(() => null), timeoutPromise]);
        }
        if (!envRes?.especies || (Number(envRes.especies?.floraTotal ?? 0) === 0 && Number(envRes.especies?.faunaTotal ?? 0) === 0)) {
          const { getEspeciesPorUbicacion } = await import('../services/gbifService');
          const especies = await getEspeciesPorUbicacion(current.lat, current.lng, 15);
          floraTotal = especies.floraTotal;
          faunaTotal = especies.faunaTotal;
          floraNombres = especies.flora.map((x) => x.nombre).filter(Boolean).slice(0, 5);
          faunaNombres = especies.fauna.map((x) => x.nombre).filter(Boolean).slice(0, 5);
        } else if (envRes?.especies) {
          floraTotal = Number(envRes.especies?.floraTotal ?? 0);
          faunaTotal = Number(envRes.especies?.faunaTotal ?? 0);
          floraNombres = (Array.isArray(envRes.especies?.flora) ? envRes.especies.flora : [])
            .map((x) => String(x?.nombre ?? '').trim())
            .filter(Boolean)
            .slice(0, 5);
          faunaNombres = (Array.isArray(envRes.especies?.fauna) ? envRes.especies.fauna : [])
            .map((x) => String(x?.nombre ?? '').trim())
            .filter(Boolean)
            .slice(0, 5);
        }
      }

      navigation.replace('RouteFinished', {
        actividadId: activityId ?? undefined,
        summary: {
          distanciaKm: distKm,
          calorias,
          tiempoSegundos: elapsedSec,
          endLat: current?.lat ?? 0,
          endLng: current?.lng ?? 0,
          tipo,
        },
        autoOpenEnvironment: false,
        routeAdvice,
        nivelActual,
        floraTotal,
        faunaTotal,
        floraNombres,
        faunaNombres,
      });
    } catch (e: any) {
      Alert.alert('Finalizar', e?.message ?? 'No se pudo finalizar la ruta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.mapWrap}>
        <LiveMap
          region={region}
          points={points}
          current={current}
          destination={destination}
          plannedRoutePoints={plannedRoutePoints}
          finalPoint={finishPoint}
          heading={heading}
          followUserLocation
          permissionOk={gps.permissionGranted}
        />
        <View style={styles.mapOverlay}>
          <Text style={styles.gpsLabel}>GPS activo</Text>
          <Text style={styles.gpsTitle}>{route.params?.destNombre ? `Ruta a ${route.params.destNombre}` : 'Ruta en tiempo real'}</Text>
          {plannedDurationMin != null ? <Text style={styles.gpsLabel}>ETA: {Math.max(1, Math.round(plannedDurationMin))} min</Text> : null}
        </View>
      </View>

      <Card style={styles.bottom}>
        <View style={styles.statsRow}>
          <Stat icon="📍" label="Km" value={formatKm(distKm)} />
          <Stat icon="🕐" label="Tiempo" value={formatHMS(elapsedSec)} />
          <Stat icon="🔥" label="Calorías" value={`${Math.round(calorias)} kcal`} />
        </View>
        <View style={styles.buttonsRow}>
          <Pressable
            onPress={() => setRobotModalVisible(true)}
            style={styles.robotBtn}
            accessibilityRole="button"
            accessibilityLabel="Consejos del asistente"
          >
            <Text style={styles.robotIcon}>🤖</Text>
          </Pressable>
          <LargeButton title={paused ? '▶ Reanudar' : '⏸ Pausar'} onPress={() => void onTogglePause()} variant="neutral" />
        </View>
        <LargeButton title={loading ? 'Procesando…' : '🏁 Finalizar ruta'} onPress={onFinishPress} variant="neutral" disabled={loading} />
        <LargeButton title="🚨 Emergencia" onPress={() => void loadContacts()} variant="danger" />
      </Card>

      <Modal visible={robotModalVisible} transparent animationType="fade" onRequestClose={() => setRobotModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🤖 Asistente de ruta</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              <Text style={styles.adviceText}>
                {routeAdviceLoading
                  ? 'Generando recomendación…'
                  : adviceIsFromStorage && routeAdvice
                    ? `Último consejo disponible:\n\n${routeAdvice}`
                    : routeAdvice || 'Toca "Actualizar recomendación" para obtener un consejo.'}
              </Text>
            </ScrollView>
            <Pressable onPress={() => void refreshRouteAdvice()} style={styles.adviceRefreshBtn} accessibilityRole="button" disabled={routeAdviceLoading}>
              <Text style={styles.adviceRefreshText}>{routeAdviceLoading ? 'Actualizando…' : 'Actualizar recomendación'}</Text>
            </Pressable>
            <LargeButton title="Cerrar" onPress={() => setRobotModalVisible(false)} variant="outlinePrimary" />
          </View>
        </View>
      </Modal>

      <Modal visible={contactsVisible} transparent animationType="fade" onRequestClose={() => setContactsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Emergencia</Text>
            {safetyLoading || contactsLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            <View style={{ gap: 8 }}>
              {EMERGENCIAS.map((item) => (
                <Pressable key={item.numero} onPress={() => void callEmergency(item.numero)} style={styles.contactRow}>
                  <Text style={styles.contactName}>{item.nombre}</Text>
                  <Text style={styles.contactPhone}>{item.numero}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalSub}>Contactos del teléfono</Text>
            <TextInput
              value={contactsQuery}
              onChangeText={setContactsQuery}
              placeholder="Buscar por nombre"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
            <View style={{ gap: 8, maxHeight: 300 }}>
              {contacts
                .filter((c) => {
                  const q = contactsQuery.trim().toLowerCase();
                  if (!q) return true;
                  return c.nombre.toLowerCase().includes(q);
                })
                .slice(0, 25)
                .map((c) => {
                return (
                  <Pressable key={c.id} onPress={() => void sendLocationToContactWhatsApp(c)} style={styles.contactRow}>
                    <Text style={styles.contactName}>{c.nombre}</Text>
                    <Text style={styles.contactPhone}>{c.numero || 'Sin número'}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <LargeButton
                title={safetyLoading ? 'Compartiendo…' : 'Compartir ubicación'}
                onPress={() => void sendLocationByWhatsApp()}
                variant="primary"
                disabled={safetyLoading}
              />
              <LargeButton title="Cerrar" onPress={() => setContactsVisible(false)} variant="outlinePrimary" />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showFinishModal} transparent animationType="fade" onRequestClose={() => setShowFinishModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🎉 ¡Felicidades! Terminaste tu ruta</Text>
            <Text style={styles.modalSub}>Distancia: {formatKm(distKm)}</Text>
            <Text style={styles.modalSub}>Tiempo: {formatHMS(elapsedSec)}</Text>
            <Text style={styles.modalSub}>Calorías: {Math.round(calorias)} kcal</Text>
            <View style={styles.modalActions}>
              <LargeButton title="Finalizar y guardar" onPress={() => void finalizeRoute()} variant="primary" />
              <LargeButton title="Cancelar" onPress={() => setShowFinishModal(false)} variant="outlinePrimary" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>
        {icon} {label}
      </Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  mapWrap: { flex: 6, backgroundColor: '#1C2B2A' },
  mapOverlay: { position: 'absolute', left: 16, top: 16, gap: 2 },
  gpsLabel: { color: '#D1D5DB', fontWeight: '700', fontFamily },
  gpsTitle: { color: 'white', fontWeight: '900', fontSize: 16, fontFamily },
  bottom: { flex: 4, marginTop: -18, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 12, gap: 4 },
  statLabel: { color: colors.muted, fontWeight: '900', fontSize: 12, fontFamily },
  statValue: { color: colors.text, fontWeight: '900', fontSize: 16, fontFamily },
  buttonsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  robotBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary },
  robotIcon: { fontSize: 28 },
  adviceCard: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, gap: 8 },
  adviceTitle: { color: colors.text, fontWeight: '900', fontFamily },
  adviceText: { color: colors.muted, fontWeight: '700', fontFamily, lineHeight: 20 },
  adviceRefreshBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.primarySoft },
  adviceRefreshText: { color: colors.primary, fontWeight: '900', fontFamily },
  emergencySection: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FEF2F2', padding: 10, gap: 8 },
  emergencyTitle: { color: colors.text, fontWeight: '900', fontSize: 14, fontFamily },
  emergencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emergencyPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emergencyName: { color: colors.text, fontWeight: '800', fontSize: 11, fontFamily },
  emergencyNum: { color: colors.primary, fontWeight: '900', fontSize: 12, fontFamily },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 460, borderRadius: 18, backgroundColor: colors.surface, padding: 16, gap: 10 },
  modalTitle: { color: colors.text, fontWeight: '900', fontFamily, fontSize: 16, textAlign: 'center' },
  modalSub: { color: colors.muted, fontWeight: '700', fontFamily, textAlign: 'center' },
  modalActions: { gap: 10 },
  searchInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily,
    fontWeight: '700',
  },
  contactRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.surface },
  contactRowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  contactName: { color: colors.text, fontWeight: '800', fontFamily },
  contactPhone: { color: colors.muted, fontWeight: '700', fontFamily, fontSize: 12 },
});

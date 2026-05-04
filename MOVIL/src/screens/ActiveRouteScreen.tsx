import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { LargeButton } from '../components/LargeButton';
import { LiveMap } from '../components/LiveMap';
import { getMonthStats } from '../services/statsService';
import { detectExtremeWeather } from '../services/weatherAlertsService';
import { requestRouteAdvice } from '../services/geminiService';
import { useSettings } from '../state/SettingsContext';
import { useRouteTracking, type RouteSessionParams } from '../state/RouteTrackingContext';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import type { AppStackParamList } from '../types/navigation';
import { formatHMS, formatKm } from '../utils/format';

type Props = NativeStackScreenProps<AppStackParamList, 'ActiveRoute'>;

type ContactOption = {
  id: string;
  nombre: string;
  numero: string;
};

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

function activeRouteParamsToSession(params: AppStackParamList['ActiveRoute']): RouteSessionParams {
  type AR = NonNullable<AppStackParamList['ActiveRoute']>;
  const p = (params ?? {}) as Partial<AR>;
  return {
    tipo: p.tipo === 'ciclismo' || p.tipo === 'senderismo' ? p.tipo : 'senderismo',
    origin: 'fullScreen',
    rutaId: p.rutaId,
    rutaNombre: p.rutaNombre,
    saveToDb: p.saveToDb,
    destLat: p.destLat,
    destLng: p.destLng,
    destNombre: p.destNombre,
    routeStartLat: p.routeStartLat,
    routeStartLng: p.routeStartLng,
    nivelSeguridad: p.nivelSeguridad,
  };
}

export function ActiveRouteScreen({ navigation, route }: Props) {
  const { settings } = useSettings();
  const tracking = useRouteTracking();

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [contactsVisible, setContactsVisible] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsQuery, setContactsQuery] = useState('');
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [routeAdvice, setRouteAdvice] = useState('');
  const [routeAdviceLoading, setRouteAdviceLoading] = useState(false);
  const [robotModalVisible, setRobotModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await tracking.beginSession(activeRouteParamsToSession(route.params));
      if (!cancelled && !ok) navigation.goBack();
    })();
    return () => {
      cancelled = true;
      tracking.cancelSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const region = useMemo(() => {
    if (!tracking.current) return undefined;
    return {
      latitude: tracking.current.lat,
      longitude: tracking.current.lng,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    };
  }, [tracking.current]);

  const fetchRouteAdvice = async () => {
    try {
      setRouteAdviceLoading(true);
      const baseUrl = (settings.apiBaseUrl ?? '').trim();
      const weather = baseUrl ? await detectExtremeWeather(baseUrl) : { clima: null };
      const climaCondicion = weather.clima?.condicion ?? 'Sin datos';
      const temperatura = weather.clima ? Number(weather.clima.temperaturaC) : null;
      const mesStats = await getMonthStats().catch(() => ({ km: 0, calorias: 0, tiempoSegundos: 0, rutas: 0 }));
      const recommendation = await requestRouteAdvice({
        kmHoy: tracking.distKm,
        caloriasHoy: tracking.calorias,
        rutasMes: mesStats.rutas,
        kmMes: mesStats.km,
        clima: climaCondicion,
        temperatura,
        hora: new Date().getHours(),
        actividad: tracking.tipo === 'ciclismo' ? 'bici' : 'caminata',
        destino: route.params?.destNombre,
        tiempoSegundos: tracking.elapsedSec,
      });
      setRouteAdvice(recommendation);
    } catch (e: unknown) {
      setRouteAdvice(e instanceof Error ? e.message : 'Servicio temporalmente no disponible, intenta más tarde.');
    } finally {
      setRouteAdviceLoading(false);
    }
  };

  const onRobotPress = () => {
    setRobotModalVisible(true);
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

  const onFinishPress = () => {
    if (!tracking.current) return;
    tracking.beginFinishConfirmation();
    setShowFinishModal(true);
  };

  const onFinalizeConfirmed = () => {
    setShowFinishModal(false);
    void tracking.completeFinalize();
  };

  const onFinishModalCancel = () => {
    setShowFinishModal(false);
    void tracking.abortFinishConfirmation();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.mapWrap}>
        <LiveMap
          region={region}
          points={tracking.points}
          current={tracking.current}
          startPoint={tracking.startPoint}
          destination={tracking.destination}
          plannedRoutePoints={tracking.plannedRoutePoints}
          finalPoint={tracking.finishPoint}
          heading={tracking.heading}
          followUserLocation
          permissionOk={tracking.permissionGranted}
          interactionMode="route_navigation"
        />
        <View style={styles.mapOverlay}>
          <Text style={styles.gpsLabel}>GPS activo</Text>
          <Text style={styles.gpsTitle}>{route.params?.destNombre ? `Ruta a ${route.params.destNombre}` : tracking.routeTitle}</Text>
          {tracking.plannedDurationMin != null ? (
            <Text style={styles.gpsLabel}>ETA: {Math.max(1, Math.round(tracking.plannedDurationMin))} min</Text>
          ) : null}
        </View>
      </View>

      <Card style={styles.bottom}>
        <View style={styles.statsRow}>
          <Stat icon="📍" label="Km" value={formatKm(tracking.distKm)} />
          <Stat icon="🕐" label="Tiempo" value={formatHMS(tracking.elapsedSec)} />
          <Stat icon="🔥" label="Calorías" value={`${Math.round(tracking.calorias)} kcal`} />
        </View>
        <View style={styles.precisionWrap}>
          <Text style={styles.precisionLabel}>GPS:</Text>
          <Pressable
            onPress={() => void tracking.setGpsPrecisionMode('normal')}
            style={[styles.precisionChip, tracking.gpsPrecisionMode === 'normal' && styles.precisionChipActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.precisionChipText, tracking.gpsPrecisionMode === 'normal' && styles.precisionChipTextActive]}>
              Normal
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void tracking.setGpsPrecisionMode('high')}
            style={[styles.precisionChip, tracking.gpsPrecisionMode === 'high' && styles.precisionChipActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.precisionChipText, tracking.gpsPrecisionMode === 'high' && styles.precisionChipTextActive]}>
              Alta precisión
            </Text>
          </Pressable>
        </View>
        <View style={styles.buttonsRow}>
          <Pressable
            onPress={onRobotPress}
            style={styles.robotBtn}
            accessibilityRole="button"
            accessibilityLabel="Consejos del asistente"
          >
            <Text style={styles.robotIcon}>🤖</Text>
          </Pressable>
          <LargeButton title={tracking.paused ? '▶ Reanudar' : '⏸ Pausar'} onPress={() => void tracking.togglePause()} variant="neutral" />
        </View>
        <LargeButton
          title={tracking.finishing ? 'Procesando…' : '🏁 Finalizar ruta'}
          onPress={onFinishPress}
          variant="neutral"
          disabled={tracking.finishing}
        />
        <LargeButton title="🚨 Emergencia" onPress={() => void loadContacts()} variant="danger" />
      </Card>

      <Modal visible={robotModalVisible} transparent animationType="fade" onRequestClose={() => setRobotModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🤖 Asistente de ruta</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              <Text style={styles.adviceText}>
                {routeAdviceLoading ? 'Generando recomendación…' : routeAdvice || 'Toca el botón para recibir recomendaciones personalizadas.'}
              </Text>
            </ScrollView>
            {!routeAdvice && !routeAdviceLoading ? (
              <LargeButton title="Obtener consejos" onPress={() => void fetchRouteAdvice()} variant="primary" />
            ) : null}
            <LargeButton title="Cerrar" onPress={() => { setRobotModalVisible(false); setRouteAdvice(''); }} variant="outlinePrimary" />
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
                .map((c) => (
                  <Pressable key={c.id} onPress={() => void sendLocationToContactWhatsApp(c)} style={styles.contactRow}>
                    <Text style={styles.contactName}>{c.nombre}</Text>
                    <Text style={styles.contactPhone}>{c.numero || 'Sin número'}</Text>
                  </Pressable>
                ))}
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

      <Modal visible={showFinishModal} transparent animationType="fade" onRequestClose={onFinishModalCancel}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🎉 ¡Felicidades! Terminaste tu ruta</Text>
            <Text style={styles.modalSub}>Distancia: {formatKm(tracking.distKm)}</Text>
            <Text style={styles.modalSub}>Tiempo: {formatHMS(tracking.elapsedSec)}</Text>
            <Text style={styles.modalSub}>Calorías: {Math.round(tracking.calorias)} kcal</Text>
            <View style={styles.modalActions}>
              <LargeButton title="Finalizar y guardar" onPress={onFinalizeConfirmed} variant="primary" disabled={tracking.finishing} />
              <LargeButton title="Seguir caminando" onPress={onFinishModalCancel} variant="outlinePrimary" disabled={tracking.finishing} />
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
  buttonsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  robotBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary },
  robotIcon: { fontSize: 28 },
  adviceText: { color: colors.muted, fontWeight: '700', fontFamily, lineHeight: 20 },
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
  contactName: { color: colors.text, fontWeight: '800', fontFamily },
  contactPhone: { color: colors.muted, fontWeight: '700', fontFamily, fontSize: 12 },
});

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';
import { useSettings } from '../state/SettingsContext';
import { fontFamily } from '../theme/typography';
import { Card } from '../components/Card';
import { LargeButton } from '../components/LargeButton';
import { TextField } from '../components/TextField';
import { apiRequest } from '../services/api';
import { DEFAULT_API_BASE_URL, EMULATOR_API_BASE_URL, normalizeApiBaseUrl } from '../config';

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const navigation = useNavigation<any>();
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState(settings.apiBaseUrl);
  const [icsUrlDraft, setIcsUrlDraft] = useState(settings.eventsCalendarIcsUrl);
  const [testingApi, setTestingApi] = useState(false);

  useEffect(() => {
    setApiBaseUrlDraft(settings.apiBaseUrl);
  }, [settings.apiBaseUrl]);

  useEffect(() => {
    setIcsUrlDraft(settings.eventsCalendarIcsUrl);
  }, [settings.eventsCalendarIcsUrl]);

  const apiBaseUrlTrimmed = useMemo(() => apiBaseUrlDraft.trim(), [apiBaseUrlDraft]);
  const icsUrlTrimmed = useMemo(() => icsUrlDraft.trim(), [icsUrlDraft]);

  const saveApiBaseUrl = () => {
    if (!apiBaseUrlTrimmed) {
      Alert.alert('URL vacía', 'Escribe una URL como: http://192.168.1.123:8084/api');
      return;
    }
    const normalized = normalizeApiBaseUrl(apiBaseUrlTrimmed);
    updateSettings({ apiBaseUrl: normalized });
    Alert.alert('Guardado', `API Base URL:\n${normalized}`);
  };

  const testApiConnection = async () => {
    if (!apiBaseUrlTrimmed) {
      Alert.alert('URL vacía', 'Escribe una URL como: http://192.168.1.123:8084/api');
      return;
    }
    const normalized = normalizeApiBaseUrl(apiBaseUrlTrimmed);
    setTestingApi(true);
    try {
      const res = await apiRequest<{ ok: boolean }>(normalized, '/health', {
        method: 'GET',
        timeoutMs: 8000,
      });
      if (res?.ok) {
        Alert.alert('Conexión OK', `Respondió /health desde:\n${normalized}`);
      } else {
        Alert.alert('Conectó, pero respuesta rara', `Respuesta de /health:\n${JSON.stringify(res)}`);
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? 'Error de red');
      const hint = msg.includes('8084') || msg.includes('timeout') || msg.includes('Tiempo de espera')
        ? '\n\nRevisa: 1) Backend corriendo en puerto 8084. 2) Firewall de Windows. 3) Celular en la misma Wi‑Fi que la PC.'
        : '';
      Alert.alert('No se pudo conectar', msg + hint);
    } finally {
      setTestingApi(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack?.()) navigation.goBack();
            else navigation.dispatch?.(DrawerActions.openDrawer());
          }}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.h1}>⚙️ Ajustes</Text>
        <View style={{ width: 44 }} />
      </View>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>VISUALIZACIÓN</Text>
        <Pressable
          onPress={() => {
            Alert.alert('Tamaño de letra', 'Selecciona un tamaño', [
              { text: 'Pequeño', onPress: () => updateSettings({ fontScale: 0.9 }) },
              { text: 'Normal', onPress: () => updateSettings({ fontScale: 1 }) },
              { text: 'Grande', onPress: () => updateSettings({ fontScale: 1.1 }) },
              { text: 'Cancelar', style: 'cancel' },
            ]);
          }}
          style={styles.row}
          accessibilityRole="button"
        >
          <Text style={styles.rowLabel}>T Tamaño de letra</Text>
          <Text style={styles.rowValue}>{settings.fontScale === 1 ? 'Normal >' : settings.fontScale < 1 ? 'Pequeño >' : 'Grande >'}</Text>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>CONEXIÓN (API)</Text>
        <Text style={styles.help}>
          Android físico (Expo Go): usa la IP de tu PC en la misma Wi‑Fi. Emulador Android: usa 10.0.2.2.
        </Text>

        <TextField
          label="API Base URL"
          value={apiBaseUrlDraft}
          onChangeText={setApiBaseUrlDraft}
          placeholder="http://192.168.1.123:8084/api"
        />

        <View style={styles.presetRow}>
          <MiniButton
            title="Producción (Render)"
            onPress={() => setApiBaseUrlDraft(DEFAULT_API_BASE_URL)}
          />
          <MiniButton
            title="Emulador (10.0.2.2:8084)"
            onPress={() => setApiBaseUrlDraft(EMULATOR_API_BASE_URL)}
          />
        </View>

        <LargeButton
          title={testingApi ? 'Probando...' : 'Probar conexión (/health)'}
          onPress={() => void testApiConnection()}
          disabled={testingApi}
          variant="outlinePrimary"
        />

        <LargeButton
          title="Guardar URL"
          onPress={saveApiBaseUrl}
          disabled={testingApi}
          variant="primary"
        />

        <Text style={styles.current}>
          Actual en uso: {settings.apiBaseUrl}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>EVENTOS (CALENDARIO)</Text>
        <Text style={styles.help}>
          Pega el link iCal (.ics) de Google Calendar para mostrar “Próximos eventos” y activar recordatorios.
        </Text>

        <TextField
          label="Link iCal (.ics)"
          value={icsUrlDraft}
          onChangeText={setIcsUrlDraft}
          placeholder="https://calendar.google.com/calendar/ical/.../private-....ics"
        />

        <LargeButton
          title="Guardar calendario"
          onPress={() => {
            updateSettings({ eventsCalendarIcsUrl: icsUrlTrimmed });
            Alert.alert('Guardado', icsUrlTrimmed ? 'Calendario configurado.' : 'Calendario removido.');
          }}
          variant="primary"
        />

        <Text style={styles.current}>
          Actual en uso: {settings.eventsCalendarIcsUrl ? 'Configurado' : 'No configurado'}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>AUDIO</Text>
        <Toggle label="🔊 Sonidos" value={settings.soundsEnabled} onToggle={() => updateSettings({ soundsEnabled: !settings.soundsEnabled })} />
        <Toggle label="🎙️ Guía por voz" value={settings.voiceGuideEnabled} onToggle={() => updateSettings({ voiceGuideEnabled: !settings.voiceGuideEnabled })} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>PERMISOS</Text>
        <Toggle label="📍 GPS" value={settings.locationPrivacy === 'precise'} onToggle={() => updateSettings({ locationPrivacy: settings.locationPrivacy === 'precise' ? 'approx' : 'precise' })} />
        <Toggle label="🔔 Notificaciones" value={true} onToggle={() => {}} />
        <Pressable
          onPress={() => {
            Alert.alert('Privacidad de ubicación', '¿Cuándo compartir tu ubicación?', [
              { text: 'Solo durante rutas', onPress: () => updateSettings({ locationPrivacy: 'precise' }) },
              { text: 'Aproximada', onPress: () => updateSettings({ locationPrivacy: 'approx' }) },
              { text: 'Cancelar', style: 'cancel' },
            ]);
          }}
          style={styles.row}
          accessibilityRole="button"
        >
          <Text style={styles.rowLabel}>🛡️ Privacidad de ubicación</Text>
          <Text style={styles.rowValue}>Solo durante rutas &gt;</Text>
        </Pressable>
      </Card>

      <LargeButton
        title="Volver al inicio"
        onPress={() => {
          // mantener simple: cerrar drawer si está abierto
          try {
            navigation.dispatch?.(DrawerActions.closeDrawer());
          } catch {}
        }}
        variant="primary"
      />
    </Screen>
  );
}

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.pill, value && styles.pillOn]}>
        <View style={[styles.dot, value && styles.dotOn]} />
      </View>
    </Pressable>
  );
}

function MiniButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.miniBtn, pressed && { opacity: 0.92 }]}
    >
      <Text style={styles.miniBtnText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.text, fontSize: 22, fontWeight: '900', fontFamily },
  h1: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 4, fontFamily },
  card: { gap: 12 },
  sectionTitle: { color: colors.muted, fontWeight: '900', fontFamily, letterSpacing: 0.4 },
  help: { color: colors.muted, fontWeight: '700', fontFamily, lineHeight: 18 },
  presetRow: { flexDirection: 'row', gap: 10 },
  miniBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnText: { color: colors.text, fontWeight: '800', fontFamily },
  current: { color: colors.muted, fontWeight: '700', fontFamily },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowLabel: { color: colors.text, fontWeight: '800', fontSize: 16, fontFamily },
  rowValue: { color: colors.muted, fontWeight: '800', fontFamily },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  toggleLabel: { color: colors.text, fontWeight: '800', fontSize: 16, fontFamily },
  pill: {
    width: 48,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: colors.primary },
  dot: { width: 22, height: 22, borderRadius: 999, backgroundColor: 'white', alignSelf: 'flex-start' },
  dotOn: { backgroundColor: colors.surface, alignSelf: 'flex-end' },
});


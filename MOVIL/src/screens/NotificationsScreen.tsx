import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { LargeButton } from '../components/LargeButton';
import { useSettings } from '../state/SettingsContext';
import { apiRequest } from '../services/api';
import { getDevicePushTokenForDebug } from '../services/push';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

export function NotificationsScreen() {
  const { settings } = useSettings();
  const isExpoGo = useMemo(() => Constants.appOwnership === 'expo', []);
  const [token, setToken] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('SENDA VIDA');
  const [message, setMessage] = useState('Notificación de prueba');

  const loadToken = async () => {
    try {
      setBusy(true);
      const t = await getDevicePushTokenForDebug();
      if (!t) {
        Alert.alert('Token', isExpoGo ? 'En Expo Go no hay push remoto. Usa Dev Build.' : 'No se pudo obtener token (revisa permisos).');
        return;
      }
      setToken(t);
      Alert.alert('Token listo', 'Se obtuvo el token del dispositivo.');
    } catch (e: any) {
      Alert.alert('Token', String(e?.message ?? e ?? 'Error'));
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    const t = token.trim();
    if (!t) return Alert.alert('Push', 'Primero obtén el token.');
    try {
      setBusy(true);
      const res = await apiRequest<any>(settings.apiBaseUrl, '/notificaciones/test', {
        method: 'POST',
        body: JSON.stringify({ token: t, title: title.trim() || 'SENDA VIDA', message: message.trim() || 'Prueba' }),
        timeoutMs: 15000,
      });
      Alert.alert('Push', res?.sent ? 'Enviado (si Firebase está configurado, debe llegar).' : `Respuesta: ${JSON.stringify(res)}`);
    } catch (e: any) {
      Alert.alert('Push', String(e?.message ?? e ?? 'Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.h1}>🔔 Notificaciones</Text>
        <Text style={styles.sub}>Push (FCM) y pruebas</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.title}>Estado</Text>
        <Text style={styles.line}>- Runtime: {isExpoGo ? 'Expo Go (push remoto NO)' : 'Dev Build (push remoto SÍ)'}</Text>
        <Text style={styles.line}>- Backend: {settings.apiBaseUrl}</Text>
        <Text style={styles.hint}>
          Para que el push llegue necesitas Dev Build + `google-services.json` (Android) y `firebase-service-account.json` en el backend.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.title}>Token del dispositivo</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder="Aquí aparecerá el token"
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <LargeButton title={busy ? '...' : 'Obtener token'} onPress={() => void loadToken()} disabled={busy} variant="primary" style={{ flex: 1 }} />
          <LargeButton
            title="Copiar"
            onPress={() => {
              if (!token.trim()) return;
              void Clipboard.setStringAsync(token.trim());
              Alert.alert('Copiado', 'Token copiado al portapapeles.');
            }}
            disabled={!token.trim()}
            variant="outlinePrimary"
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.title}>Push de prueba</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Título" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Mensaje"
          placeholderTextColor={colors.muted}
          style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
          multiline
        />
        <LargeButton title={busy ? 'Enviando…' : 'Enviar push de prueba'} onPress={() => void sendTest()} disabled={busy || !token.trim()} variant="neutral" />

        <Pressable
          onPress={() => {
            Alert.alert(
              'Si no llega…',
              '1) Asegúrate de NO usar Expo Go.\n2) Coloca google-services.json en MOVIL/.\n3) En backend agrega firebase-service-account.json.\n4) Reinicia backend y recompila el Dev Build.'
            );
          }}
          accessibilityRole="button"
          style={{ paddingVertical: 6 }}
        >
          <Text style={[styles.hint, { textAlign: 'center', textDecorationLine: 'underline' }]}>¿Por qué no llega?</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, paddingBottom: 6 },
  h1: { color: colors.text, fontWeight: '900', fontSize: 18, fontFamily },
  sub: { color: colors.muted, fontWeight: '700', fontFamily },
  card: { gap: 10 },
  title: { color: colors.text, fontWeight: '900', fontFamily, fontSize: 16 },
  line: { color: colors.muted, fontWeight: '700', fontFamily },
  hint: { color: colors.muted, fontWeight: '700', fontFamily, lineHeight: 18, fontSize: 12 },
  input: {
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
});


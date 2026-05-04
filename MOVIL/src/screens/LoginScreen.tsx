import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { useSettings } from '../state/SettingsContext';
import { apiRequest, formatApiErrorMessage, userFacingHttpHint, type ApiError } from '../services/api';
import type { AuthStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loginErrorAlert(e: unknown): void {
  const base = formatApiErrorMessage(e);
  const status = typeof e === 'object' && e !== null && 'status' in e ? Number((e as ApiError).status) : NaN;
  const hint = Number.isFinite(status) ? userFacingHttpHint(status) : null;
  const lower = base.toLowerCase();
  let title = 'No se pudo iniciar sesión';
  let message = hint ? `${base}\n\n${hint}` : base;

  if (lower.includes('credencial')) {
    title = 'Credenciales incorrectas';
    message =
      'El correo o la contraseña no coinciden. Comprueba mayúsculas, espacios al inicio o al final del correo, y que estés usando el mismo correo con el que te registraste.';
  } else if (Number(status) === 404) {
    title = 'No se encontró el servidor';
    message = `${base}\n\nComprueba en Ajustes → Conexión que la URL termine en /api (ej. https://senda-vida.onrender.com/api).`;
  }

  Alert.alert(title, message);
}

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [correoError, setCorreoError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const disabled = useMemo(() => loading, [loading]);

  const validate = (): boolean => {
    setCorreoError('');
    setPasswordError('');
    const mail = correo.trim();
    if (!mail) {
      setCorreoError('Ingresa tu correo electrónico.');
      return false;
    }
    if (!EMAIL_RE.test(mail)) {
      setCorreoError('Introduce un correo válido (ej. nombre@servicio.com).');
      return false;
    }
    if (!password.length) {
      setPasswordError('Ingresa tu contraseña.');
      return false;
    }
    return true;
  };

  const clearFieldError = (field: 'correo' | 'password') => {
    if (field === 'correo') setCorreoError('');
    else setPasswordError('');
  };

  const onSubmit = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      try {
        await apiRequest<{ ok: boolean }>(settings.apiBaseUrl, '/health', {
          method: 'GET',
          timeoutMs: 15000,
        });
      } catch {
        Alert.alert(
          'Sin conexión al servidor',
          'No pudimos alcanzar la API. Revisa tu conexión a internet, confirma en Ajustes → Conexión que uses https://senda-vida.onrender.com/api y vuelve a intentar.'
        );
        return;
      }
      await login({ correo: correo.trim(), password });
    } catch (e: unknown) {
      loginErrorAlert(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>Iniciar sesión</Text>
      <Text style={styles.subtitle}>Accede con el correo y la contraseña de tu cuenta</Text>

      <TextField
        label="Correo"
        value={correo}
        onChangeText={(t) => {
          setCorreo(t);
          clearFieldError('correo');
        }}
        placeholder="tu@correo.com"
        keyboardType="email-address"
        autoCorrect={false}
        error={correoError}
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          clearFieldError('password');
        }}
        placeholder="Tu contraseña"
        secureTextEntry
        error={passwordError}
        hint="Si acabas de registrarte, usa la misma contraseña que elegiste."
      />

      <PrimaryButton
        title={loading ? 'Ingresando…' : 'Entrar'}
        onPress={onSubmit}
        disabled={disabled}
      />

      <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
        ¿No tienes cuenta? Crear cuenta
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 4 },
  subtitle: { marginTop: 2, color: colors.muted, fontWeight: '600', marginBottom: 8 },
  link: { marginTop: 14, textAlign: 'center', color: colors.accent, fontSize: 16, fontWeight: '700' },
});

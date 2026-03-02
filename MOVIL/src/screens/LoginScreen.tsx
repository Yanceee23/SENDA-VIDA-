import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { useSettings } from '../state/SettingsContext';
import { apiRequest } from '../services/api';
import type { AuthStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');

  const disabled = useMemo(() => !correo.trim() || !password, [correo, password]);

  const onSubmit = async () => {
    try {
      setLoading(true);
      // Verificación rápida de conectividad (5s) antes del login
      try {
        await apiRequest<{ ok: boolean }>(settings.apiBaseUrl, 'health', {
          method: 'GET',
          timeoutMs: 5000,
        });
      } catch {
        Alert.alert(
          'Servidor no disponible',
          'No se puede conectar al servidor. Verifica que estés en la misma red WiFi y que la IP del servidor sea correcta.'
        );
        return;
      }
      await login({ correo, password });
    } catch (e: any) {
      Alert.alert('No se pudo iniciar sesión', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>Iniciar sesión</Text>
      <Text style={styles.subtitle}>Usa tu correo y contraseña</Text>

      <TextField
        label="Correo"
        value={correo}
        onChangeText={setCorreo}
        placeholder="tu@correo.com"
        keyboardType="email-address"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        placeholder="••••"
        secureTextEntry
      />

      <PrimaryButton
        title={loading ? 'Ingresando...' : 'Entrar'}
        onPress={onSubmit}
        disabled={disabled || loading}
      />

      <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
        ¿No tienes cuenta? Crear cuenta
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 4 },
  subtitle: { marginTop: 2, color: colors.muted, fontWeight: '600' },
  link: { marginTop: 14, textAlign: 'center', color: colors.accent, fontSize: 16, fontWeight: '700' },
});


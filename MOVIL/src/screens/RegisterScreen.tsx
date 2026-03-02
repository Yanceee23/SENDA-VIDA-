import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import type { AuthStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const prefs = [
  { id: 'ciclismo', label: 'Ciclismo' },
  { id: 'senderismo', label: 'Senderismo' },
  { id: 'ambos', label: 'Ambos' },
] as const;

const generos = [
  { id: 'femenino', label: 'Femenino' },
  { id: 'masculino', label: 'Masculino' },
  { id: 'otro', label: 'Otro' },
] as const;

export function RegisterScreen({ navigation }: Props) {
  const { register, continueAsGuest } = useAuth();
  const [loading, setLoading] = useState(false);

  const [nombre, setNombre] = useState('');
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [genero, setGenero] = useState<(typeof generos)[number]['id']>('otro');
  const [preferencia, setPreferencia] = useState<(typeof prefs)[number]['id']>('ambos');

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!nombre.trim()) e.push('Ingresa tu nombre.');
    if (!correo.trim() || !correo.includes('@')) e.push('Ingresa un correo válido.');
    if (!password || password.length < 4) e.push('La contraseña debe tener al menos 4 caracteres.');
    return e;
  }, [nombre, correo, password]);

  const onSubmit = async () => {
    if (errors.length) return Alert.alert('Revisa tus datos', errors.join('\n'));
    try {
      setLoading(true);
      await register({
        nombre,
        correo,
        password,
        edad: edad ? Number(edad) : undefined,
        peso: peso ? Number(peso) : undefined,
        altura: altura ? Number(altura) : undefined,
        genero,
        preferencia,
      });
    } catch (e: any) {
      Alert.alert('No se pudo crear la cuenta', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.subtitle}>Campos obligatorios marcados con *</Text>

      <TextField label="Nombre *" value={nombre} onChangeText={setNombre} placeholder="Tu nombre" autoCapitalize="words" />
      <TextField label="Edad" value={edad} onChangeText={setEdad} placeholder="Ej: 25" keyboardType="numeric" />
      <TextField label="Peso (kg)" value={peso} onChangeText={setPeso} placeholder="Ej: 70" keyboardType="numeric" />
      <TextField label="Altura (cm)" value={altura} onChangeText={setAltura} placeholder="Ej: 170" keyboardType="numeric" />
      <TextField label="Correo electrónico *" value={correo} onChangeText={setCorreo} placeholder="tu@correo.com" keyboardType="email-address" />
      <TextField label="Contraseña *" value={password} onChangeText={setPassword} placeholder="••••" secureTextEntry />

      <View style={{ gap: 8 }}>
        <Text style={styles.sectionLabel}>Género (opcional)</Text>
        <View style={styles.chipsRow}>
          {generos.map((g) => (
            <Chip key={g.id} label={g.label} active={genero === g.id} onPress={() => setGenero(g.id)} />
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={styles.sectionLabel}>Preferencia (opcional)</Text>
        <View style={styles.chipsRow}>
          {prefs.map((p) => (
            <Chip key={p.id} label={p.label} active={preferencia === p.id} onPress={() => setPreferencia(p.id)} />
          ))}
        </View>
      </View>

      <PrimaryButton title={loading ? 'Creando...' : 'Crear cuenta'} onPress={onSubmit} disabled={loading} />

      <Pressable
        accessibilityRole="button"
        onPress={() => continueAsGuest()}
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.secondaryText}>Modo invitado</Text>
      </Pressable>

      <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
        ¿Ya tienes cuenta? Inicia sesión
      </Text>
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 4 },
  subtitle: { marginTop: 2, color: colors.muted, fontWeight: '600' },
  sectionLabel: { color: colors.text, fontWeight: '800' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '700' },
  chipTextActive: { color: colors.primary },
  secondaryBtn: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  link: { marginTop: 14, textAlign: 'center', color: colors.accent, fontSize: 16, fontWeight: '700' },
});


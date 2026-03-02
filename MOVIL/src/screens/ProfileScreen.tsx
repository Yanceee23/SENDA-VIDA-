import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { apiRequest } from '../services/api';
import { useAuth } from '../state/AuthContext';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme/colors';

export function ProfileScreen() {
  const { settings } = useSettings();
  const { status, user, logout, requireUserId, updateUser, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [perfil, setPerfil] = useState<any | null>(null);

  const [nombre, setNombre] = useState(user?.nombre ?? '');
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [genero, setGenero] = useState(user?.genero ?? '');
  const [preferencia, setPreferencia] = useState(user?.preferencia ?? '');

  const load = async () => {
    if (status !== 'signedIn') return;
    try {
      setLoading(true);
      const id = requireUserId();
      const res = await apiRequest<any>(settings.apiBaseUrl, `/usuarios/${id}`);
      setPerfil(res);
      setNombre(String(res?.nombre ?? ''));
      setEdad(res?.edad != null ? String(res.edad) : '');
      setPeso(res?.peso != null ? String(res.peso) : '');
      setAltura(res?.altura != null ? String(res.altura) : '');
      setGenero(res?.genero != null ? String(res.genero) : '');
      setPreferencia(res?.preferencia != null ? String(res.preferencia) : '');
    } catch (e: any) {
      Alert.alert('No se pudo cargar perfil', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, settings.apiBaseUrl]);

  const guardar = async () => {
    if (status !== 'signedIn') return;
    try {
      setLoading(true);
      const id = requireUserId();
      const body: any = { nombre: nombre.trim() };
      if (edad) body.edad = Number(edad);
      if (peso) body.peso = Number(peso);
      if (altura) body.altura = Number(altura);
      if (genero) body.genero = genero;
      if (preferencia) body.preferencia = preferencia;
      await apiRequest(settings.apiBaseUrl, `/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      await updateUser({
        nombre: body.nombre,
        edad: body.edad,
        peso: body.peso,
        altura: body.altura,
        genero: body.genero,
        preferencia: body.preferencia,
      });
      await refreshUserProfile();
      Alert.alert('Listo', 'Perfil actualizado.');
      await load();
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (status !== 'signedIn') {
    return (
      <Screen>
        <Text style={styles.h1}>Perfil</Text>
        <Text style={styles.note}>Modo invitado: inicia sesión para ver tu perfil.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.h1}>Perfil</Text>
      <Text style={styles.note}>ID: {user?.userId}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos</Text>
        <TextField label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Tu nombre" autoCapitalize="words" />
        <TextField label="Edad" value={edad} onChangeText={setEdad} placeholder="Ej: 25" keyboardType="numeric" />
        <TextField label="Peso (kg)" value={peso} onChangeText={setPeso} placeholder="Ej: 70" keyboardType="numeric" />
        <TextField label="Altura (cm)" value={altura} onChangeText={setAltura} placeholder="Ej: 170" keyboardType="numeric" />
        <TextField label="Género" value={genero} onChangeText={setGenero} placeholder="otro" />
        <TextField label="Preferencia" value={preferencia} onChangeText={setPreferencia} placeholder="ciclismo/senderismo/ambos" />

        <Pressable onPress={guardar} style={[styles.btn, loading && { opacity: 0.6 }]} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Guardando…' : 'Guardar cambios'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Puntos ecológicos</Text>
        <Text style={styles.big}>{perfil?.puntosEco ?? user?.puntosEco ?? 0}</Text>
      </View>

      <Pressable
        onPress={() => logout()}
        style={[styles.btn, { backgroundColor: colors.danger }]}
      >
        <Text style={styles.btnText}>Cerrar sesión</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 4 },
  big: { fontSize: 26, fontWeight: '900', color: colors.text },
  note: { marginTop: 2, color: colors.muted, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  cardTitle: { color: colors.text, fontWeight: '900', fontSize: 16 },
  btn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '900', fontSize: 16 },
});


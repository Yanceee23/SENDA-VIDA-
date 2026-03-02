import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { PrimaryButton } from '../components/PrimaryButton';
import { apiRequest, toQuery } from '../services/api';
import { useAuth } from '../state/AuthContext';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme/colors';

type Reto = {
  id: number;
  tipoReto: string;
  puntos: number;
  estado: 'pendiente' | 'completado' | string;
};

const retosDefault = [
  { tipoReto: 'Recolectar basura durante el recorrido', puntos: 10 },
  { tipoReto: 'No dejar residuos', puntos: 10 },
];

export function EcoChallengesScreen() {
  const { settings } = useSettings();
  const { status, user, requireUserId } = useAuth();

  const [loading, setLoading] = useState(false);
  const [retos, setRetos] = useState<Reto[]>([]);

  const load = async () => {
    if (status !== 'signedIn') return;
    if (!settings.apiBaseUrl?.trim()) return;
    try {
      setLoading(true);
      const usuarioId = requireUserId();
      const res = await apiRequest<any>(settings.apiBaseUrl, `/retos/${usuarioId}/pendientes`, {
        token: user?.token,
      });
      const list = Array.isArray(res) ? res : [];
      setRetos(
        list.map((r: any) => ({
          id: Number(r.id),
          tipoReto: String(r.tipoReto ?? r.tipo_reto ?? 'Reto'),
          puntos: Number(r.puntos ?? 0),
          estado: String(r.estado ?? 'pendiente'),
        }))
      );
    } catch (e: any) {
      Alert.alert('No se pudieron cargar los retos', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, settings.apiBaseUrl]);

  const crearDefault = async () => {
    try {
      setLoading(true);
      const usuarioId = requireUserId();
      for (const r of retosDefault) {
        await apiRequest(
          settings.apiBaseUrl,
          `/retos${toQuery({ usuarioId, tipoReto: r.tipoReto, puntos: r.puntos })}`,
          { method: 'POST' }
        );
      }
      await load();
    } catch (e: any) {
      Alert.alert('No se pudieron crear', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  const completar = async (id: number) => {
    try {
      setLoading(true);
      await apiRequest(settings.apiBaseUrl, `/retos/${id}/completar`, { method: 'PUT' });
      await load();
    } catch (e: any) {
      Alert.alert('No se pudo completar', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (status !== 'signedIn') {
    return (
      <Screen scroll>
        <Text style={styles.h1}>Retos ecológicos del lugar</Text>
        <Text style={styles.sub}>Marca retos completados y gana puntos ecológicos.</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Inicia sesión para ver y completar retos ecológicos.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.h1}>Retos ecológicos del lugar</Text>
      <Text style={styles.sub}>Marca retos completados y gana puntos ecológicos.</Text>

      <PrimaryButton title={loading ? 'Cargando...' : 'Agregar retos sugeridos'} onPress={crearDefault} disabled={loading} />

      <View style={{ gap: 10 }}>
        {retos.length ? (
          retos.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => completar(r.id)}
              disabled={loading || r.estado !== 'pendiente'}
              style={[styles.item, (loading || r.estado !== 'pendiente') && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.itemTitle}>{r.tipoReto}</Text>
                <Text style={styles.itemSub}>+{r.puntos} puntos • Estado: {r.estado}</Text>
              </View>
              <MaterialCommunityIcons
                name={r.estado === 'pendiente' ? 'checkbox-blank-circle-outline' : 'checkbox-marked-circle'}
                size={26}
                color={r.estado === 'pendiente' ? colors.muted : colors.primary}
              />
            </Pressable>
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tienes retos pendientes todavía.</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 4 },
  sub: { marginTop: 2, color: colors.muted, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  itemTitle: { color: colors.text, fontWeight: '900', fontSize: 16 },
  itemSub: { color: colors.muted, fontWeight: '700' },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  emptyText: { color: colors.muted, fontWeight: '700' },
});


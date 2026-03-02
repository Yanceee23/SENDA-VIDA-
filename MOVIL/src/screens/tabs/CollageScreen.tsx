import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Screen } from '../../components/Screen';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../state/AuthContext';
import { useSettings } from '../../state/SettingsContext';
import { colors } from '../../theme/colors';
import { fontFamily } from '../../theme/typography';
import { Card } from '../../components/Card';
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native';

type Foto = {
  id: number;
  urlFoto: string;
  lat: number;
  lng: number;
  creadoEn?: string;
  nombreLugar?: string;
  actividadId?: number | null;
  rutaId?: number | null;
};

export function CollageScreen() {
  const navigation = useNavigation<any>();
  const { settings } = useSettings();
  const { status, requireUserId } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const load = async () => {
    if (status !== 'signedIn') return;
    if (!settings.apiBaseUrl?.trim()) return;
    try {
      setLoading(true);
      setFailedUrls(new Set());
      const usuarioId = requireUserId();
      const baseUrl = settings.apiBaseUrl.replace(/\/+$/, '');
      const res = await apiRequest<any[]>(baseUrl, `/fotos/${usuarioId}`);
      const list = Array.isArray(res) ? res : [];

      const toAbsolute = (url: string) => {
        const u = (url ?? '').trim();
        if (!u) return '';
        if (/^(https?:|file:|content:|data:)/i.test(u)) return u;
        return `${baseUrl}/${u.replace(/^\/+/, '')}`;
      };

      setFotos(
        list.map((f: any) => ({
          id: Number(f.id),
          urlFoto: toAbsolute(String(f.urlFoto ?? f.url_foto ?? '')),
          lat: (() => {
            const direct = f.lat ?? f.latitude ?? undefined;
            if (direct !== undefined) return Number(direct);
            try {
              const gps = typeof f.gps === 'string' ? JSON.parse(f.gps) : f.gps;
              return Number(gps?.lat ?? 0);
            } catch {
              return 0;
            }
          })(),
          lng: (() => {
            const direct = f.lng ?? f.longitude ?? undefined;
            if (direct !== undefined) return Number(direct);
            try {
              const gps = typeof f.gps === 'string' ? JSON.parse(f.gps) : f.gps;
              return Number(gps?.lng ?? 0);
            } catch {
              return 0;
            }
          })(),
          creadoEn: f.creadoEn ?? f.creado_en ?? f.hora ?? f.createdAt,
          nombreLugar: f.nombreLugar ?? f.nombre_lugar ?? f.lugar ?? undefined,
          actividadId: f.actividad?.id ?? f.actividadId ?? f.actividad_id ?? null,
          rutaId: f.ruta?.id ?? f.rutaId ?? f.ruta_id ?? null,
        }))
      );
    } catch (e: any) {
      Alert.alert('No se pudieron cargar fotos', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, settings.apiBaseUrl])
  );

  const agregarFoto = async () => {
    if (status !== 'signedIn') {
      Alert.alert('Inicia sesión', 'El álbum requiere una cuenta.');
      return;
    }
    if (!settings.apiBaseUrl?.trim()) {
      Alert.alert('Configuración', 'Configura la URL del backend en Ajustes → Conexión (API).');
      return;
    }
    try {
      setLoading(true);
      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (locPerm.status !== 'granted') {
        Alert.alert('GPS', 'Necesitamos ubicación para guardar GPS en la foto.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const usuarioId = requireUserId();
      // asociar a actividad activa si existe
      let actividadId: number | undefined = undefined;
      try {
        const act = await apiRequest<any>(settings.apiBaseUrl, `/actividades/activa/${usuarioId}`);
        if (act?.id) actividadId = Number(act.id);
      } catch {
        // ignore
      }

      navigation.navigate('CameraCapture', { lat, lng, actividadId: actividadId ?? null });
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  const eliminarFoto = async (id: number) => {
    if (!settings.apiBaseUrl?.trim()) {
      Alert.alert('Configuración', 'Configura la URL del backend en Ajustes → Conexión (API).');
      return;
    }
    Alert.alert('Eliminar', '¿Eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(settings.apiBaseUrl, `/fotos/${id}`, { method: 'DELETE' });
            setFotos((prev) => prev.filter((f) => f.id !== id));
          } catch (e: any) {
            Alert.alert('No se pudo eliminar', e?.message ?? 'Error');
          }
        },
      },
    ]);
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
        <Text style={styles.h1}>📷 Collage / Álbum</Text>
        <View style={{ width: 44 }} />
      </View>

      <Pressable
        onPress={agregarFoto}
        style={[styles.takeBtn, loading && { opacity: 0.7 }]}
        disabled={loading}
        accessibilityRole="button"
      >
        <Text style={styles.takeText}>📷 Tomar foto</Text>
      </Pressable>
      {loading ? <ActivityIndicator /> : null}

      <View style={styles.grid}>
        {fotos.map((f) => (
          <Card key={f.id} style={styles.photoCard}>
            {f.urlFoto && !failedUrls.has(f.urlFoto) ? (
              <Image
                source={{ uri: f.urlFoto }}
                style={styles.photo}
                onError={() => setFailedUrls((prev) => new Set(prev).add(f.urlFoto))}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderIcon}>📷</Text>
              </View>
            )}
            <View style={styles.photoMeta}>
              <Text style={styles.placeName}>
                {(() => {
                  const hm = f.creadoEn ? String(f.creadoEn).slice(11, 16) : '';
                  const base = (f.nombreLugar ?? '').trim() || 'Lugar visitado';
                  return hm ? `${base} - ${hm}` : base;
                })()}
              </Text>
              <Text style={styles.metaText}>📍 {f.lat.toFixed(4)}, {f.lng.toFixed(4)}</Text>
              <Text style={styles.metaText}>🕐 {f.creadoEn ? String(f.creadoEn).slice(11, 16) : '—'}</Text>
              <Pressable onPress={() => void eliminarFoto(f.id)} style={styles.deleteBtn} accessibilityRole="button">
                <Text style={styles.deleteText}>🗑️ Eliminar</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </View>

      {!loading && status === 'signedIn' && fotos.length === 0 ? (
        <Text style={styles.emptyText}>Aún no tienes fotos guardadas.</Text>
      ) : null}
      {status !== 'signedIn' ? (
        <Text style={styles.emptyText}>Modo invitado: inicia sesión para usar el álbum.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.text, fontSize: 22, fontWeight: '900', fontFamily },
  h1: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 4, fontFamily },

  takeBtn: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: colors.surface,
    paddingVertical: 14,
    alignItems: 'center',
  },
  takeText: { color: colors.text, fontWeight: '900', fontFamily },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48%', padding: 0, overflow: 'hidden' },
  photo: { width: '100%', height: 140, backgroundColor: '#E5E7EB' },
  placeholder: { width: '100%', height: 140, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 30, opacity: 0.7 },
  photoMeta: { padding: 12, gap: 4 },
  placeName: { color: colors.text, fontWeight: '900', fontFamily },
  metaText: { color: colors.muted, fontWeight: '700', fontSize: 12, fontFamily },
  deleteBtn: { marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: '#FEE2E2' },
  deleteText: { color: colors.danger, fontWeight: '900', fontFamily, fontSize: 12 },
  emptyText: { color: colors.muted, fontWeight: '700', fontFamily, textAlign: 'center', marginTop: 10 },
});


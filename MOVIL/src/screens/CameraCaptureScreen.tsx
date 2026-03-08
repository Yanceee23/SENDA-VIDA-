import React, { useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { useAuth } from '../state/AuthContext';
import { useSettings } from '../state/SettingsContext';

type RouteParams = {
  lat?: number;
  lng?: number;
  actividadId?: number | null;
  rutaId?: number | null;
};

export function CameraCaptureScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route?.params ?? {}) as RouteParams;

  const { requireUserId } = useAuth();
  const { settings } = useSettings();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [scanText, setScanText] = useState<string>('');
  const [scanUrl, setScanUrl] = useState<string | null>(null);

  const lat = useMemo(() => Number(params.lat ?? 0), [params.lat]);
  const lng = useMemo(() => Number(params.lng ?? 0), [params.lng]);
  const actividadId = params.actividadId ?? null;
  const rutaId = params.rutaId ?? null;

  const subir = async (uri: string) => {
    const baseUrl = (settings.apiBaseUrl ?? '').trim();
    if (!baseUrl) {
      Alert.alert('Configuración', 'Configura la URL del backend en Ajustes → Conexión (API).');
      return;
    }
    const usuarioId = requireUserId();
    const url = `${baseUrl.replace(/\/+$/, '')}/fotos/upload`;

    const parameters: Record<string, string> = {
      usuarioId: String(usuarioId),
      lat: String(lat),
      lng: String(lng),
    };
    try {
      const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const first = reverse[0];
      if (first) {
        const city = String(first.city ?? '').trim();
        const district = String(first.district ?? first.subregion ?? '').trim();
        const name = String(first.name ?? '').trim();
        const placeName = name && city ? `${name}, ${city}` : city && district ? `${city}, ${district}` : city || district || name;
        if (placeName) {
          parameters.nombreLugar = placeName;
        }
      }
    } catch {
      // ignore reverse geocode failures
    }
    if (actividadId !== null) parameters.actividadId = String(actividadId);
    if (rutaId !== null) parameters.rutaId = String(rutaId);

    let fileUri = uri;
    if (fileUri.startsWith('content://')) {
      try {
        const to = `${FileSystem.cacheDirectory ?? ''}upload_${Date.now()}.jpg`;
        if (to) {
          await FileSystem.copyAsync({ from: fileUri, to });
          fileUri = to;
        }
      } catch {
        // si falla, intentamos con el URI original
      }
    }

    const res = await FileSystem.uploadAsync(url, fileUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'image/jpeg',
      parameters,
    });

    if (res.status < 200 || res.status >= 300) {
      let msg = `Error HTTP ${res.status}`;
      const body = String(res.body ?? '').trim();
      if (body) {
        try {
          const j = JSON.parse(body);
          msg = String((j && typeof j === 'object' && ('error' in j ? (j as any).error : (j as any).message)) || msg);
        } catch {
          msg = body;
        }
      }
      throw new Error(msg);
    }
  };

  const tomarFoto = async () => {
    if (busy) return;
    try {
      setBusy(true);

      const cam = cameraRef.current as any;
      if (!cam?.takePictureAsync) throw new Error('Cámara no lista');

      const photo = await cam.takePictureAsync({ quality: 0.75, exif: false });
      const uri = String(photo?.uri ?? '');
      if (!uri) throw new Error('No se pudo obtener la foto');

      await subir(uri);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Cámara', e?.message ?? 'No se pudo tomar/subir la foto');
    } finally {
      setBusy(false);
    }
  };

  const normalizeHttpUrl = (raw: string): string | null => {
    const t = String(raw ?? '').trim();
    if (!t) return null;
    const withScheme = /^www\./i.test(t) ? `https://${t}` : t;
    if (!/^https?:\/\//i.test(withScheme)) return null;
    try {
      const u = new URL(withScheme);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.toString();
    } catch {
      return null;
    }
  };

  const onBarcodeScanned = (event: any) => {
    const raw = String(event?.data ?? '').trim();
    if (!raw) return;
    setScanned(true);
    setScanText(raw);
    setScanUrl(normalizeHttpUrl(raw));
    setQrModalVisible(true);
  };

  const closeQrModal = () => setQrModalVisible(false);
  const scanAnother = () => {
    setQrModalVisible(false);
    setScanText('');
    setScanUrl(null);
    setScanned(false);
  };

  const onOpen = async () => {
    if (!scanUrl) return;
    try {
      const ok = await Linking.canOpenURL(scanUrl);
      if (!ok) {
        Alert.alert('No se pudo abrir', 'No hay una app disponible para abrir este enlace.');
        return;
      }
      await Linking.openURL(scanUrl);
    } catch (e: any) {
      Alert.alert('No se pudo abrir', e?.message ?? 'Error');
    }
  };

  const onCopy = async () => {
    const value = scanUrl ?? scanText;
    if (!value) return;
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert('Copiado', 'Se copió al portapapeles.');
    } catch (e: any) {
      Alert.alert('No se pudo copiar', e?.message ?? 'Error');
    }
  };

  const onShare = async () => {
    const value = scanUrl ?? scanText;
    if (!value) return;
    try {
      await Share.share({ message: value });
    } catch (e: any) {
      Alert.alert('No se pudo compartir', e?.message ?? 'Error');
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Cargando permisos de cámara…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Necesitamos permiso de cámara para escanear/tomar foto.</Text>
        <Pressable onPress={() => void requestPermission()} style={styles.primaryBtn} accessibilityRole="button">
          <Text style={styles.primaryText}>Dar permiso</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.secondaryBtn} accessibilityRole="button">
          <Text style={styles.secondaryText}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
      />

      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => scanAnother()}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{scanUrl ? 'Enlace detectado' : 'Código detectado'}</Text>
            <Text style={styles.modalText} numberOfLines={5}>
              {scanUrl ?? scanText}
            </Text>

            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => void onOpen()}
                style={[styles.modalBtn, !scanUrl && styles.modalBtnDisabled]}
                disabled={!scanUrl}
                accessibilityRole="button"
              >
                <Text style={[styles.modalBtnText, !scanUrl && styles.modalBtnTextDisabled]}>Abrir</Text>
              </Pressable>
              <Pressable onPress={() => void onCopy()} style={styles.modalBtn} accessibilityRole="button">
                <Text style={styles.modalBtnText}>Copiar</Text>
              </Pressable>
              <Pressable onPress={() => void onShare()} style={styles.modalBtn} accessibilityRole="button">
                <Text style={styles.modalBtnText}>Compartir</Text>
              </Pressable>
            </View>

            <View style={styles.modalFooter}>
              <Pressable onPress={closeQrModal} style={styles.modalLinkBtn} accessibilityRole="button">
                <Text style={styles.modalLinkText}>Cerrar</Text>
              </Pressable>
              <Pressable onPress={scanAnother} style={styles.modalLinkBtn} accessibilityRole="button">
                <Text style={styles.modalLinkText}>Escanear otro</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.topBtn} accessibilityRole="button">
          <Text style={styles.topBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.title}>Escanear / Tomar foto</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          onPress={tomarFoto}
          style={[styles.shutter, busy && { opacity: 0.7 }]}
          disabled={busy || qrModalVisible}
          accessibilityRole="button"
        >
          <Text style={styles.shutterText}>{busy ? 'Subiendo…' : 'Tomar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  title: { color: '#fff', fontWeight: '900', fontFamily, fontSize: 16 },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBtnText: { color: '#fff', fontSize: 22, fontWeight: '900', fontFamily },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    paddingBottom: 22,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  shutter: {
    minWidth: 160,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  shutterText: { color: '#fff', fontWeight: '900', fontFamily },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: colors.bg, gap: 12 },
  msg: { color: colors.text, fontWeight: '800', fontFamily, textAlign: 'center' },
  primaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.primary },
  primaryText: { color: '#fff', fontWeight: '900', fontFamily },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#e5e7eb' },
  secondaryText: { color: colors.text, fontWeight: '900', fontFamily },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 18, backgroundColor: colors.surface, padding: 16, gap: 12 },
  modalTitle: { color: colors.text, fontWeight: '900', fontFamily, fontSize: 16, textAlign: 'center' },
  modalText: { color: colors.text, fontWeight: '700', fontFamily, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  modalBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.primary, minWidth: 96, alignItems: 'center' },
  modalBtnDisabled: { backgroundColor: '#CBD5E1' },
  modalBtnText: { color: '#fff', fontWeight: '900', fontFamily },
  modalBtnTextDisabled: { color: '#334155' },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  modalLinkBtn: { paddingVertical: 10, paddingHorizontal: 10 },
  modalLinkText: { color: colors.muted, fontWeight: '900', fontFamily },
});


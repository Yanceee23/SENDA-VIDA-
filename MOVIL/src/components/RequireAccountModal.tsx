import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme/colors';
import { scaleFont } from '../theme/scale';
import { fontFamily } from '../theme/typography';
import { Card } from './Card';
import { LargeButton } from './LargeButton';

export function RequireAccountModal({
  visible,
  onClose,
  onCreateAccount,
}: {
  visible: boolean;
  onClose: () => void;
  onCreateAccount: () => void;
}) {
  const { settings } = useSettings();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
        <View />
      </Pressable>
      <View style={styles.center}>
        <Card style={styles.modalCard}>
          <Text style={[styles.title, { fontSize: scaleFont(16, settings.fontScale) }]}>
            Necesitas iniciar sesion para continuar
          </Text>
          <Text style={[styles.sub, { fontSize: scaleFont(14, settings.fontScale), lineHeight: scaleFont(20, settings.fontScale) }]}>
            Inicia sesion o crea una cuenta para usar esta funcion.
          </Text>

          <View style={{ gap: 10 }}>
            <LargeButton title="Crear cuenta / Iniciar sesion" onPress={onCreateAccount} variant="primary" />
          </View>

          <Pressable onPress={onClose} style={styles.closeLink} accessibilityRole="button">
            <Text style={[styles.closeText, { fontSize: scaleFont(14, settings.fontScale) }]}>Cerrar</Text>
          </Pressable>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 420, gap: 10 },
  title: { color: colors.text, fontWeight: '900', fontFamily, textAlign: 'center' },
  sub: { color: colors.muted, fontWeight: '600', fontFamily, textAlign: 'center' },
  closeLink: { paddingTop: 4 },
  closeText: { color: colors.muted, textAlign: 'center', fontFamily, fontWeight: '700' },
});


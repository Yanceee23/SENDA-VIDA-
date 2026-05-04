import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import type { AuthStackParamList } from '../types/navigation';
import { fontFamily } from '../theme/typography';
import { LargeButton } from '../components/LargeButton';
import { useAuth } from '../state/AuthContext';
import { useSettings } from '../state/SettingsContext';
import { scaleFont } from '../theme/scale';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { continueAsGuest } = useAuth();
  const { settings } = useSettings();
  return (
    <View style={styles.wrap}>
      <View style={styles.bg} />
      <View style={styles.overlay} />

      <View style={styles.content}>
        <View style={styles.logoWrap} accessibilityLabel="Logo SENDA VIDA">
          <Text style={[styles.logoText, { fontSize: scaleFont(26, settings.fontScale) }]}>🚲</Text>
          <Text style={[styles.logoText, { fontSize: scaleFont(26, settings.fontScale) }]}>👣</Text>
          <Text style={[styles.logoText, { fontSize: scaleFont(26, settings.fontScale) }]}>🍃</Text>
        </View>
        <View style={styles.dotsRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <View style={[styles.dot, { backgroundColor: colors.brown }]} />
          <View style={[styles.dot, { backgroundColor: colors.greenAlt }]} />
        </View>

        <Text style={[styles.title, { fontSize: scaleFont(38, settings.fontScale) }]}>SENDA VIDA</Text>
        <View style={styles.sep} />

        <Text style={[styles.subtitle, { fontSize: scaleFont(16, settings.fontScale), lineHeight: scaleFont(22, settings.fontScale) }]}>
          Explora rutas ecológicas seguras y cuida el planeta mientras descubres la naturaleza
        </Text>

        <View style={{ flex: 1 }} />

        <View style={styles.bottom}>
          <LargeButton title="Ya tengo cuenta" onPress={() => navigation.navigate('Login')} variant="primary" />
          <LargeButton title="Crear cuenta" onPress={() => navigation.navigate('Register')} variant="outlinePrimary" />
          <Pressable onPress={() => continueAsGuest()} accessibilityRole="button">
            <Text style={styles.guestLink}>Continuar como invitado</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#1B4332' },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1B4332' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  content: {
    flex: 1,
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
  },

  logoWrap: {
    marginTop: 8,
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  logoText: { color: 'white' },

  dotsRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 10 },
  dot: { width: 16, height: 16, borderRadius: 999 },

  title: {
    marginTop: 22,
    textAlign: 'center',
    fontWeight: '900',
    color: 'white',
    letterSpacing: 3,
    fontFamily,
  },
  sep: { marginTop: 12, width: 64, height: 3, borderRadius: 99, backgroundColor: colors.primary },
  subtitle: {
    marginTop: 16,
    textAlign: 'center',
    color: 'white',
    paddingHorizontal: 32,
    fontWeight: '600',
    fontFamily,
  },

  bottom: { width: '100%', gap: 12, paddingHorizontal: 6 },
  guestLink: {
    marginTop: 6,
    textAlign: 'center',
    color: 'white',
    fontSize: 14,
    textDecorationLine: 'underline',
    fontFamily,
    fontWeight: '600',
  },
});


import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function SplashScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>SENDA VIDA</Text>
      <Text style={styles.subtitle}>Ciclismo • Senderismo • Naturaleza</Text>
      <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 18 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 34, fontWeight: '900', color: colors.text, letterSpacing: 0.6 },
  subtitle: { marginTop: 8, fontSize: 16, color: colors.muted, fontWeight: '600' },
});


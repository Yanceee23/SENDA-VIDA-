import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function PlaceholderScreen({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 16, fontWeight: '600', textAlign: 'center' },
});


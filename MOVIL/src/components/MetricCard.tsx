import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme/colors';
import { scaleFont } from '../theme/scale';
import { fontFamily } from '../theme/typography';
import { Card } from './Card';

export function MetricCard({
  icon,
  value,
  label,
  style,
}: {
  icon?: string;
  value: string;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { settings } = useSettings();
  return (
    <Card style={[styles.card, style]}>
      {icon ? <Text style={[styles.icon, { fontSize: scaleFont(18, settings.fontScale) }]}>{icon}</Text> : null}
      <Text style={[styles.value, { fontSize: scaleFont(20, settings.fontScale) }]}>{value}</Text>
      <Text style={[styles.label, { fontSize: scaleFont(12, settings.fontScale) }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 14, paddingHorizontal: 14, gap: 4, flex: 1 },
  icon: {},
  value: { color: colors.text, fontWeight: '900', fontFamily },
  label: { color: colors.muted, fontWeight: '700', fontFamily },
});


import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme/colors';
import { scaleFont } from '../theme/scale';
import { fontFamily } from '../theme/typography';

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const { settings } = useSettings();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { fontSize: scaleFont(14, settings.fontScale) }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'none'}
        style={[styles.input, { fontSize: scaleFont(16, settings.fontScale) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: colors.text, fontWeight: '700', fontFamily },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontFamily,
  },
});


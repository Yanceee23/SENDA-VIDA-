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
  autoCorrect,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  error?: string;
  hint?: string;
}) {
  const { settings } = useSettings();
  const effectiveAutoCorrect = autoCorrect !== undefined ? autoCorrect : !secureTextEntry;
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
        autoCorrect={effectiveAutoCorrect}
        style={[
          styles.input,
          { fontSize: scaleFont(16, settings.fontScale) },
          error?.trim() ? { borderColor: colors.danger } : null,
        ]}
      />
      {hint && !error ? (
        <Text style={[styles.hint, { fontSize: scaleFont(12, settings.fontScale) }]} accessibilityRole="text">
          {hint}
        </Text>
      ) : null}
      {error?.trim() ? (
        <Text style={[styles.error, { fontSize: scaleFont(12, settings.fontScale) }]} accessibilityRole="alert">
          {error.trim()}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: colors.text, fontWeight: '700', fontFamily },
  hint: { color: colors.muted, fontWeight: '600', fontFamily, marginTop: -2 },
  error: { color: colors.danger, fontWeight: '700', fontFamily, marginTop: -2 },
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


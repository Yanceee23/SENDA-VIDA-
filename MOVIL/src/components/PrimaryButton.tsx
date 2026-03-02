import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { useSettings } from '../state/SettingsContext';
import { scaleFont } from '../theme/scale';

export function PrimaryButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { settings } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: scaleFont(16, settings.fontScale) }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    width: '100%',
  },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.55 },
  text: {
    color: 'white',
    fontWeight: '700',
    letterSpacing: 0.2,
    fontFamily,
  },
});


import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { useSettings } from '../state/SettingsContext';
import { scaleFont } from '../theme/scale';

type Variant = 'primary' | 'brown' | 'water' | 'danger' | 'outlinePrimary' | 'lightDanger' | 'neutral';

const variantStyles: Record<
  Variant,
  { bg: string; fg: string; border?: string; dashed?: boolean }
> = {
  primary: { bg: colors.primary, fg: colors.surface },
  brown: { bg: colors.brown, fg: colors.surface },
  water: { bg: colors.accent, fg: colors.surface },
  danger: { bg: colors.danger, fg: colors.surface },
  outlinePrimary: { bg: 'transparent', fg: colors.primary, border: colors.primary },
  lightDanger: { bg: '#FEE2E2', fg: colors.danger, border: '#FECACA' },
  neutral: { bg: '#F3F4F6', fg: colors.text, border: '#D1D5DB' },
};

export function LargeButton({
  title,
  onPress,
  disabled,
  variant = 'primary',
  left,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  left?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { settings } = useSettings();
  const v = variantStyles[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? 'transparent',
          borderStyle: v.dashed ? 'dashed' : 'solid',
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {left ? <View style={styles.left}>{left}</View> : null}
        <Text style={[styles.text, { color: v.fg, fontSize: scaleFont(16, settings.fontScale) }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  left: { marginLeft: -6 },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.6 },
  text: {
    fontWeight: '700',
    fontFamily,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});


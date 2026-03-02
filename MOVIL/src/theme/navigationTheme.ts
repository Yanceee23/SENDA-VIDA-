import { DefaultTheme, type Theme } from '@react-navigation/native';
import { colors } from './colors';

export const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
    notification: colors.accent,
  },
};


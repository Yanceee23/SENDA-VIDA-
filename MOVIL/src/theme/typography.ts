import { Platform } from 'react-native';

export const fontFamily =
  Platform.OS === 'web'
    ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    : Platform.select({
        ios: 'System',
        android: 'System',
        default: 'System',
      });


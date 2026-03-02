import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

export function Screen({
  children,
  scroll,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  if (scroll) {
    return (
      <ScrollView
        style={styles.base}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={styles.base}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: 18, gap: 14 },
});


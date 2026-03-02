import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { Card } from '../../components/Card';
import { LargeButton } from '../../components/LargeButton';
import { Screen } from '../../components/Screen';
import { useHydrationReminders } from '../../state/HydrationRemindersContext';
import { colors } from '../../theme/colors';
import { fontFamily } from '../../theme/typography';

export function HydrationScreen() {
  const navigation = useNavigation<any>();
  const { glassesToday, addGlass, toggles, setToggle } = useHydrationReminders();

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack?.()) navigation.goBack();
            else navigation.dispatch?.(DrawerActions.openDrawer());
          }}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.h1}>💧 Hidratación</Text>
        <View style={{ width: 44 }} />
      </View>

      <Card style={[styles.card, { backgroundColor: '#E8F5F9' }]}>
        <Text style={styles.waterIcon}>💧</Text>
        <Text style={styles.big}>{glassesToday}</Text>
        <Text style={styles.sub}>vasos de agua hoy</Text>

        <View style={styles.capsRow}>
          {Array.from({ length: 8 }).map((_, i) => {
            const on = i < glassesToday;
            return <View key={i} style={[styles.capsule, on ? styles.capOn : styles.capOff]} />;
          })}
        </View>

        <LargeButton title="+ Agregar vaso" onPress={addGlass} variant="water" />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Recordatorios</Text>

        <RowToggle
          icon="🕐"
          title="Cada 30 min"
          subtitle="Durante ruta activa"
          value={toggles.duringRoute30m}
          onToggle={(v) => void setToggle('duringRoute30m', v)}
        />
        <RowToggle
          icon="🕐"
          title="Cada 1 hora"
          subtitle="En reposo"
          value={toggles.rest1h}
          onToggle={(v) => void setToggle('rest1h', v)}
        />
        <RowToggle
          icon="🕐"
          title="Post-ruta"
          subtitle="Hidratación de recuperación"
          value={toggles.postRoute}
          onToggle={(v) => void setToggle('postRoute', v)}
        />
        <RowToggle
          icon="🍽️"
          title="Comida (cada 3 horas)"
          subtitle="Para mantener energía"
          value={toggles.food3h}
          onToggle={(v) => void setToggle('food3h', v)}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Alertas de descanso</Text>
        <Text style={styles.bullet}>- Descansa si hay calor extremo o fatiga.</Text>
        <Text style={styles.bullet}>- Busca sombra y mantén hidratación.</Text>
      </Card>
    </Screen>
  );
}

function RowToggle({
  icon,
  title,
  subtitle,
  value,
  onToggle,
}: {
  icon: string;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onToggle(!value)} style={styles.toggleRow} accessibilityRole="button">
      <View style={{ gap: 2, flex: 1 }}>
        <Text style={styles.toggleTitle}>
          {icon} {title}
        </Text>
        <Text style={styles.toggleSub}>{subtitle}</Text>
      </View>
      <View style={[styles.switch, value ? styles.switchOn : styles.switchOff]}>
        <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.text, fontSize: 22, fontWeight: '900', fontFamily },
  h1: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 4, fontFamily },

  card: { gap: 12 },
  waterIcon: { fontSize: 34, textAlign: 'center' },
  big: { fontSize: 34, fontWeight: '900', color: colors.text, textAlign: 'center', fontFamily },
  sub: { marginTop: -4, color: colors.muted, fontWeight: '700', textAlign: 'center', fontFamily },

  capsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6 },
  capsule: { width: 28, height: 14, borderRadius: 999 },
  capOn: { backgroundColor: colors.accent },
  capOff: { backgroundColor: '#D1D5DB' },

  sectionTitle: { color: colors.text, fontWeight: '900', fontSize: 16, fontFamily },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 10 },
  toggleTitle: { color: colors.text, fontWeight: '900', fontFamily },
  toggleSub: { color: colors.muted, fontWeight: '700', fontFamily, fontSize: 12 },
  switch: { width: 52, height: 30, borderRadius: 999, padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.primary },
  switchOff: { backgroundColor: '#D1D5DB' },
  knob: { width: 24, height: 24, borderRadius: 999, backgroundColor: 'white' },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },

  bullet: { color: colors.muted, fontWeight: '700', lineHeight: 20, fontFamily },
});


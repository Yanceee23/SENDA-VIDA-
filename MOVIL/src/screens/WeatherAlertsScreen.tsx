import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { Card } from '../components/Card';
import { obtenerClimaActual, type ClimaActual } from '../services/climaService';
import { useSettings } from '../state/SettingsContext';

export function WeatherAlertsScreen() {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [actual, setActual] = useState<ClimaActual | null>(null);

  const cargar = async () => {
    try {
      setLoading(true);
      const a = await obtenerClimaActual(settings.apiBaseUrl);
      setActual(a);
    } catch (e: any) {
      Alert.alert('No se pudo cargar clima', e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen scroll>
      <View style={styles.row}>
        <Text style={styles.h1}>Clima y alertas</Text>
        <Pressable onPress={cargar} style={{ padding: 8 }} accessibilityRole="button">
          <Text style={styles.refresh}>↻</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>Datos vía API central • Probabilidad de lluvia y alertas de seguridad</Text>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Ahora</Text>
        {actual ? (
          <>
            <Text style={styles.big}>
              {actual.icono} {Math.round(actual.temperaturaC)}°C • {actual.condicion}
            </Text>
            <Text style={styles.note}>
              {actual.vientoKmh != null ? `Viento: ${Math.round(actual.vientoKmh)} km/h` : 'Sin datos de viento'}
            </Text>
          </>
        ) : (
          <Text style={styles.note}>{loading ? 'Cargando…' : 'Sin datos.'}</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Prob. de lluvia (próximas horas)</Text>
        {actual?.probLluviaProximasHoras?.length ? (
          actual.probLluviaProximasHoras.map((h) => (
            <View key={h.hora} style={styles.hourRow}>
              <Text style={styles.hour}>{h.hora}</Text>
              <Text style={styles.hourProb}>{Math.round(h.prob)}%</Text>
            </View>
          ))
        ) : (
          <Text style={styles.note}>{loading ? 'Cargando…' : 'Sin datos de probabilidad.'}</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Alertas</Text>
        <Text style={styles.bullet}>- Lluvia: precaución en senderos resbaladizos.</Text>
        <Text style={styles.bullet}>- Calor extremo: hidrátate y descansa.</Text>
        <Text style={styles.bullet}>- Polución: (integración próxima).</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 4, fontFamily },
  sub: { marginTop: 2, color: colors.muted, fontWeight: '700', fontFamily },
  refresh: { color: colors.muted, fontWeight: '900', fontFamily, fontSize: 18 },
  card: { gap: 10 },
  cardTitle: { color: colors.text, fontWeight: '900', fontSize: 16, fontFamily },
  big: { color: colors.text, fontWeight: '900', fontSize: 18, fontFamily },
  note: { color: colors.muted, fontWeight: '700', fontFamily },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  hour: { color: colors.text, fontWeight: '800', fontFamily },
  hourProb: { color: colors.accent, fontWeight: '900', fontFamily },
  bullet: { color: colors.muted, fontWeight: '700', lineHeight: 20 },
});


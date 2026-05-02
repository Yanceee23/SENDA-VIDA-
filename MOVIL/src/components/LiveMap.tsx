import React, { Component, Suspense } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import type { LatLng } from '../utils/gps';
import type { MapInteractionMode } from './LiveMapNative';
import { OfflineSimpleMap } from './OfflineSimpleMap';

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export type LiveMapProps = {
  region: Region | undefined;
  points: LatLng[];
  current: LatLng | null;
  startPoint?: LatLng | null;
  destination?: LatLng | null;
  plannedRoutePoints?: LatLng[];
  finalPoint?: LatLng | null;
  heading?: number | null;
  followUserLocation?: boolean;
  permissionOk: boolean;
  interactionMode?: MapInteractionMode;
};

const LazyNativeLiveMap = React.lazy(() =>
  import('./LiveMapNative').catch(() => ({
    default: function MapFallback(props: {
      region: Region;
      points: LatLng[];
      current: LatLng | null;
      startPoint?: LatLng | null;
      destination?: LatLng | null;
      plannedRoutePoints?: LatLng[];
    }) {
      return <OfflineSimpleMap points={props.points} current={props.current} title="Mapa" />;
    },
  }))
);

class MapErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError = () => ({ hasError: true });
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function LiveMap({
  region,
  points,
  current,
  startPoint,
  destination,
  plannedRoutePoints,
  finalPoint,
  heading,
  followUserLocation,
  permissionOk,
  interactionMode = 'follow_zoom',
}: LiveMapProps) {
  if (!region) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
        <Text style={styles.placeholderText}>Buscando señal GPS…</Text>
      </View>
    );
  }

  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    return (
      <MapErrorBoundary
        fallback={
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <Text style={styles.placeholderText}>Mapa no disponible</Text>
          </View>
        }
      >
        <OfflineSimpleMap points={points} current={current} title="Mapa simple (offline)" />
      </MapErrorBoundary>
    );
  }

  return (
    <MapErrorBoundary
      fallback={
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Text style={styles.placeholderText}>Mapa no disponible</Text>
        </View>
      }
    >
      <Suspense
        fallback={
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <ActivityIndicator />
            <Text style={styles.placeholderSub}>Cargando mapa…</Text>
          </View>
        }
      >
        <LazyNativeLiveMap
          region={region}
          points={points}
          current={current}
          startPoint={startPoint ?? null}
          destination={destination ?? null}
          plannedRoutePoints={plannedRoutePoints ?? []}
          finalPoint={finalPoint ?? null}
          heading={heading ?? null}
          followUserLocation={followUserLocation ?? true}
          permissionOk={permissionOk}
          interactionMode={interactionMode}
        />
      </Suspense>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C2B2A', gap: 6, paddingHorizontal: 18 },
  placeholderText: { color: '#D1D5DB', fontWeight: '800', fontFamily, textAlign: 'center' },
  placeholderSub: { color: colors.muted, fontWeight: '700', fontFamily, fontSize: 12, textAlign: 'center' },
});


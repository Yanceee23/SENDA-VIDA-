import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { colors } from '../theme/colors';
import type { LatLng } from '../utils/gps';
import { OfflineSimpleMap } from './OfflineSimpleMap';

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export type LiveMapNativeProps = {
  region: Region;
  points: LatLng[];
  current: LatLng | null;
  destination?: LatLng | null;
  plannedRoutePoints?: LatLng[];
  finalPoint?: LatLng | null;
  heading?: number | null;
  followUserLocation?: boolean;
  permissionOk: boolean;
};

export default function LiveMapNative({
  region,
  points,
  current,
  destination,
  plannedRoutePoints,
  finalPoint,
  heading,
  followUserLocation,
  permissionOk,
}: LiveMapNativeProps) {
  if (!MapLibreGL) {
    return <OfflineSimpleMap points={points} current={current} title="Mapa" />;
  }

  const plannedGeoJson = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: (plannedRoutePoints ?? []).map((p) => [p.lng, p.lat]),
      },
    }),
    [plannedRoutePoints]
  );

  const trailGeoJson = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: points.map((p) => [p.lng, p.lat]),
      },
    }),
    [points]
  );

  return (
    <MapLibreGL.MapView
      style={StyleSheet.absoluteFill}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
    >
      <MapLibreGL.Camera
        centerCoordinate={[region.longitude, region.latitude]}
        zoomLevel={16}
        heading={Number.isFinite(heading) ? Number(heading) : 0}
        followUserLocation={Boolean(followUserLocation && permissionOk)}
      />

      <MapLibreGL.UserLocation visible={permissionOk} />

      {plannedRoutePoints && plannedRoutePoints.length >= 2 ? (
        <MapLibreGL.ShapeSource id="planned-route-source" shape={plannedGeoJson as any}>
          <MapLibreGL.LineLayer
            id="planned-route-line"
            style={{
              lineColor: colors.accent,
              lineWidth: 4,
            }}
          />
        </MapLibreGL.ShapeSource>
      ) : null}

      {points.length >= 2 ? (
        <MapLibreGL.ShapeSource id="trail-source" shape={trailGeoJson as any}>
          <MapLibreGL.LineLayer
            id="trail-line"
            style={{
              lineColor: colors.greenAlt,
              lineWidth: 4,
              lineDasharray: [2, 2],
            }}
          />
        </MapLibreGL.ShapeSource>
      ) : null}

      {points[0] ? (
        <MapLibreGL.PointAnnotation id="start-marker" coordinate={[points[0].lng, points[0].lat]}>
          <View style={styles.startDot} />
        </MapLibreGL.PointAnnotation>
      ) : null}

      {destination ? (
        <MapLibreGL.PointAnnotation id="destination-marker" coordinate={[destination.lng, destination.lat]}>
          <View style={styles.destDot} />
        </MapLibreGL.PointAnnotation>
      ) : null}

      {finalPoint ? (
        <MapLibreGL.PointAnnotation id="final-marker" coordinate={[finalPoint.lng, finalPoint.lat]}>
          <View style={styles.finalDot} />
        </MapLibreGL.PointAnnotation>
      ) : null}
    </MapLibreGL.MapView>
  );
}

const styles = StyleSheet.create({
  startDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: colors.greenAlt,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  destDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  finalDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
});


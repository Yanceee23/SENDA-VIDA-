import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapLibreGL, { CameraRef, UserTrackingMode } from '@maplibre/maplibre-react-native';
import { colors } from '../theme/colors';
import type { LatLng } from '../utils/gps';
import { OfflineSimpleMap } from './OfflineSimpleMap';

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/** Seguir usuario nativo (limita gestos). | Igual que “lugares”: zoom manual + encuar ruta cuando quieras. */
export type MapInteractionMode = 'follow_zoom' | 'route_navigation';

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
  interactionMode?: MapInteractionMode;
};

function deltaToZoom(latDelta: number): number {
  const d = Math.min(Math.max(latDelta, 0.003), 80);
  return Math.round(Math.min(17, Math.max(4, 14 + Math.log2(0.02 / d))));
}

function bboxFrom(coords: LatLng[]): { ne: [number, number]; sw: [number, number] } | null {
  if (!coords.length) return null;
  let minLat = coords[0].lat;
  let maxLat = coords[0].lat;
  let minLng = coords[0].lng;
  let maxLng = coords[0].lng;
  for (let i = 1; i < coords.length; i++) {
    const p = coords[i];
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  if (Math.abs(maxLat - minLat) < 8e-5 && Math.abs(maxLng - minLng) < 8e-5) return null;
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
}

/** Expande muy poco bbox para rutas rectas muy cortas */
function padTinyBox(box: { ne: [number, number]; sw: [number, number] }) {
  const pad = 0.03;
  return {
    ne: [Math.min(box.ne[0] + pad, 180), Math.min(box.ne[1] + pad, 90)] as [number, number],
    sw: [Math.max(box.sw[0] - pad, -180), Math.max(box.sw[1] - pad, -90)] as [number, number],
  };
}

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
  interactionMode = 'follow_zoom',
}: LiveMapNativeProps) {
  if (!MapLibreGL) {
    return <OfflineSimpleMap points={points} current={current} title="Mapa" />;
  }

  const cameraRef = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const autoFitRanForSig = useRef<string>('');
  const [routeNavUserMoved, setRouteNavUserMoved] = useState(false);

  const navMode = interactionMode === 'route_navigation';

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

  const routeSig = useMemo(() => {
    const pr = plannedRoutePoints ?? [];
    if (pr.length >= 8) return `n=${pr.length}:${pr[0].lat}:${pr[0].lng}:${pr[pr.length - 1].lat}:${pr[pr.length - 1].lng}`;
    return pr.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  }, [plannedRoutePoints]);

  const collectNavPoints = useCallback(() => {
    const out: LatLng[] = [];
    const pr = plannedRoutePoints ?? [];
    if (pr.length >= 2) {
      for (const p of pr) out.push(p);
    } else if (points.length >= 2) {
      const tail = points.length > 80 ? points.slice(-80) : points;
      for (const p of tail) out.push(p);
    }
    if (destination) out.push(destination);
    if (current) out.push(current);
    return out;
  }, [plannedRoutePoints, destination, current, points]);

  const fitRouteFrame = useCallback(
    (animationMs: number) => {
      const cam = cameraRef.current;
      if (!cam) return;
      const pts = collectNavPoints();
      if (pts.length < 2) return;
      let box = bboxFrom(pts);
      if (!box) return;
      const spanLat = Math.abs(box.ne[1] - box.sw[1]);
      const spanLng = Math.abs(box.ne[0] - box.sw[0]);
      if (spanLat < 0.04 || spanLng < 0.04) {
        box = padTinyBox(box);
      }
      cam.fitBounds(box.ne, box.sw, [100, 60, 200, 60], animationMs);
    },
    [collectNavPoints]
  );

  useEffect(() => {
    if (!navMode) return;
    autoFitRanForSig.current = '';
  }, [routeSig, navMode]);

  useEffect(() => {
    if (!navMode || !mapReady) return;

    const run = () => {
      const pts = collectNavPoints();
      if (pts.length < 2) return;
      if (autoFitRanForSig.current === routeSig) return;
      fitRouteFrame(1600);
      autoFitRanForSig.current = routeSig;
    };

    const tid = setTimeout(run, 400);
    return () => clearTimeout(tid);
  }, [navMode, mapReady, routeSig, collectNavPoints, fitRouteFrame]);

  useEffect(() => {
    if (!navMode || !mapReady || routeNavUserMoved) return;

    const id = setInterval(() => {
      const pts = collectNavPoints();
      if (pts.length < 2 || !cameraRef.current) return;
      fitRouteFrame(4200);
    }, 48000);

    return () => clearInterval(id);
  }, [navMode, mapReady, routeNavUserMoved, collectNavPoints, fitRouteFrame, current?.lat, current?.lng]);

  const onRegionDidChange = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point, { isUserInteraction?: boolean }>) => {
      if (!navMode) return;
      const isUser = Boolean(feature.properties?.isUserInteraction);
      if (isUser) setRouteNavUserMoved(true);
    },
    [navMode]
  );

  const zoom = deltaToZoom(region.latitudeDelta);

  const useNativeFollow =
    interactionMode === 'follow_zoom' && Boolean(followUserLocation && permissionOk);

  const cameraHeading = navMode ? 0 : Number.isFinite(Number(heading)) ? Number(heading) : 0;

  const navDefaultSettings = useMemo(
    () => ({
      centerCoordinate: [region.longitude, region.latitude] as [number, number],
      zoomLevel: Math.min(13, zoom),
      animationDuration: 0,
    }),
    // Solo anclar el primer encuadre; el usuario y fitBounds toman el control después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFill}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        zoomEnabled
        scrollEnabled
        pitchEnabled={!navMode}
        rotateEnabled
        onDidFinishLoadingMap={() => setMapReady(true)}
        onRegionDidChange={onRegionDidChange as any}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={navMode ? navDefaultSettings : undefined}
          followUserLocation={useNativeFollow}
          followUserMode={UserTrackingMode.FollowWithHeading}
          followZoomLevel={zoom}
          centerCoordinate={navMode ? undefined : [region.longitude, region.latitude]}
          zoomLevel={navMode ? undefined : zoom}
          heading={cameraHeading}
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

      {navMode ? (
        <View style={styles.navFabWrap} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver ruta completa y volver a seguir el mapa con la ruta"
            style={({ pressed }) => [styles.navFab, pressed && styles.navFabPressed]}
            onPress={() => {
              setRouteNavUserMoved(false);
              fitRouteFrame(3800);
            }}
          >
            <Text style={styles.navFabText}>📍 Vista ruta</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
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
  navFabWrap: {
    position: 'absolute',
    right: 10,
    top: '18%',
    zIndex: 20,
    maxWidth: 160,
    gap: 8,
    pointerEvents: 'box-none',
  },
  navFab: {
    backgroundColor: 'rgba(28,43,42,0.92)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  navFabPressed: { opacity: 0.92 },
  navFabText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 13,
    textAlign: 'center',
  },
});

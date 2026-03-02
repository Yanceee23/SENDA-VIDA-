import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import type { LatLng } from '../utils/gps';

const hasSvgComponents = Boolean(Svg && Circle && Polyline);

export function OfflineSimpleMap({
  points,
  current,
  title = 'Mapa offline simple',
}: {
  points: LatLng[];
  current: LatLng | null;
  title?: string;
}) {
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const data = useMemo(() => {
    const all: LatLng[] = [...(points ?? [])];
    if (current) all.push(current);
    if (!all.length) return null;

    let minLat = all[0].lat;
    let maxLat = all[0].lat;
    let minLng = all[0].lng;
    let maxLng = all[0].lng;
    for (const p of all) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    return { minLat, maxLat, minLng, maxLng };
  }, [points, current]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!width || !height) return;
    setSize({ w: width, h: height });
  };

  const padding = 14;
  const projected = useMemo(() => {
    if (!data || size.w <= 0 || size.h <= 0) return '';
    const { minLat, maxLat, minLng, maxLng } = data;

    const spanLat = Math.max(0.00001, maxLat - minLat);
    const spanLng = Math.max(0.00001, maxLng - minLng);
    const w = Math.max(1, size.w - padding * 2);
    const h = Math.max(1, size.h - padding * 2);

    const project = (p: LatLng) => {
      const x = padding + ((p.lng - minLng) / spanLng) * w;
      const y = padding + (1 - (p.lat - minLat) / spanLat) * h;
      return { x, y };
    };

    const polyPoints = (points ?? [])
      .map((p) => {
        const { x, y } = project(p);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const start = points?.[0] ? project(points[0]) : null;
    const cur = current ? project(current) : null;

    return { polyPoints, start, cur };
  }, [data, points, current, size.w, size.h]);

  const polyPoints = typeof projected === 'string' ? '' : projected.polyPoints;
  const startXY = typeof projected === 'string' ? null : projected.start;
  const currentXY = typeof projected === 'string' ? null : projected.cur;

  if (!hasSvgComponents) {
    return (
      <View style={[styles.wrap, styles.empty]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.emptyText}>Mapa no disponible en este entorno</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View style={styles.top}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>Sin tiles: dibuja tu ruta para uso offline</Text>
      </View>

      <View style={styles.canvas}>
        {size.w > 0 && size.h > 0 && data ? (
          <Svg width={size.w} height={size.h}>
            {polyPoints && points.length >= 2 ? (
              <Polyline
                points={polyPoints}
                fill="none"
                stroke={colors.greenAlt}
                strokeWidth={4}
                strokeDasharray="10 8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {startXY ? (
              <Circle
                cx={startXY.x}
                cy={startXY.y}
                r={7}
                fill={colors.greenAlt}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={2}
              />
            ) : null}

            {currentXY ? (
              <>
                <Circle cx={currentXY.x} cy={currentXY.y} r={10} fill="rgba(46,134,171,0.22)" />
                <Circle cx={currentXY.x} cy={currentXY.y} r={6} fill={colors.accent} stroke="white" strokeWidth={2} />
              </>
            ) : null}
          </Svg>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Esperando datos de ruta…</Text>
          </View>
        )}

        {current ? (
          <View style={styles.nowBadge}>
            <Text style={styles.nowText}>📍 Ubicación actual</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#1C2B2A' },
  top: { position: 'absolute', left: 16, top: 16, right: 16, zIndex: 2, gap: 2 },
  title: { color: '#D1D5DB', fontWeight: '900', fontFamily },
  sub: { color: '#8B9A94', fontWeight: '700', fontFamily, fontSize: 12 },
  canvas: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  emptyText: { color: '#D1D5DB', fontWeight: '800', fontFamily, textAlign: 'center' },
  nowBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  nowText: { color: 'white', fontWeight: '800', fontFamily, fontSize: 12 },
});


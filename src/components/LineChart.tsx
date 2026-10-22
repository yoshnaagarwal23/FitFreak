import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { colors, layout, spacing } from '@/theme';

import { AppText } from './AppText';

export type ChartPoint = { label: string; value: number };

type Props = {
  points: ChartPoint[];
  formatValue: (v: number) => string;
  accessibilityLabel: string;
};

const PAD_Y = layout.chartMarker; // keeps markers from clipping at the top/bottom edge

// Single-series line chart. Tap a point to read its value; the latest point is labeled directly.
export function LineChart({ points, formatValue, accessibilityLabel }: Props) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const height = layout.chartHeight;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Enforce a minimum span (10% of the top value) so tiny changes don't look dramatic,
  // centering the data within it. Never extend below zero.
  const rawSpan = rawMax - rawMin;
  const span = Math.max(rawSpan, Math.max(1, rawMax * 0.1));
  const min = Math.max(0, rawMin - (span - rawSpan) / 2);
  const max = min + span;

  // Right padding keeps the last marker from clipping at the edge.
  const plotWidth = Math.max(0, width - layout.chartAxisWidth - layout.chartMarker);
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const x = (i: number) => layout.chartAxisWidth + (points.length > 1 ? i * step : plotWidth / 2);
  const y = (v: number) => PAD_Y + (1 - (v - min) / (max - min)) * (height - PAD_Y * 2);

  const active = selected ?? points.length - 1;
  const activePoint = points[active];

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.wrap}>
      <AppText variant="caption" muted>
        {selected === null ? 'Latest' : activePoint.label} ·{' '}
        <AppText variant="caption">{formatValue(activePoint.value)}</AppText>
      </AppText>

      <View style={{ height }} onLayout={onLayout}>
        {width > 0 ? (
          <>
            <Svg width={width} height={height}>
              {/* Recessive gridlines at max and min */}
              {[max, min].map((v) => (
                <Line
                  key={v}
                  x1={layout.chartAxisWidth}
                  x2={width}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
              <Polyline
                points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
                fill="none"
                stroke={colors.primary}
                strokeWidth={layout.chartLine}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map((p, i) => (
                <Circle
                  key={i}
                  cx={x(i)}
                  cy={y(p.value)}
                  r={layout.chartMarker / 2 + (i === active ? 2 : 0)}
                  fill={i === active ? colors.primary : colors.background}
                  stroke={colors.primary}
                  strokeWidth={layout.chartLine}
                />
              ))}
            </Svg>

            {/* Axis labels */}
            <View style={[styles.axisLabel, { top: y(max) - spacing.sm }]}>
              <AppText variant="caption" muted>
                {formatValue(max)}
              </AppText>
            </View>
            <View style={[styles.axisLabel, { top: y(min) - spacing.sm }]}>
              <AppText variant="caption" muted>
                {formatValue(min)}
              </AppText>
            </View>

            {/* Hit targets: one full-height band per point, wider than the marker */}
            <View style={[StyleSheet.absoluteFill, styles.bands]}>
              {points.map((p, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.label}: ${formatValue(p.value)}`}
                  onPress={() => setSelected(i === selected ? null : i)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: x(i) - Math.max(step, layout.buttonHeight) / 2,
                    width: Math.max(step, layout.buttonHeight),
                  }}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>

      <View style={[styles.xLabels, { marginLeft: layout.chartAxisWidth }]}>
        <AppText variant="caption" muted>
          {points[0].label}
        </AppText>
        {points.length > 1 ? (
          <AppText variant="caption" muted>
            {points[points.length - 1].label}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  axisLabel: {
    position: 'absolute',
    left: 0,
    width: layout.chartAxisWidth - spacing.sm - layout.chartMarker / 2,
    alignItems: 'flex-end',
  },
  bands: {
    overflow: 'hidden',
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

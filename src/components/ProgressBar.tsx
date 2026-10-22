import { StyleSheet, View } from 'react-native';

import { colors, layout, radius } from '@/theme';

type Props = {
  value: number;
  max: number;
  accessibilityLabel: string;
};

// Horizontal bar; turns dark blue once value passes max.
export function ProgressBar({ value, max, accessibilityLabel }: Props) {
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}>
      <View
        style={[
          styles.fill,
          { width: `${fraction * 100}%`, backgroundColor: over ? colors.primaryDark : colors.primary },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: layout.barHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});

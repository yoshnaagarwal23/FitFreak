import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout, radius, spacing } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  value: number;
  onChange: (delta: -1 | 1) => void;
  canDecrease?: boolean;
  canIncrease?: boolean;
};

// Compact "label  −  value  +" control.
export function Stepper({ label, value, onChange, canDecrease = true, canIncrease = true }: Props) {
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <View style={styles.row}>
        <StepButton symbol="−" label={`Decrease ${label}`} onPress={() => onChange(-1)} disabled={!canDecrease} />
        <AppText style={styles.value}>{value}</AppText>
        <StepButton symbol="+" label={`Increase ${label}`} onPress={() => onChange(1)} disabled={!canIncrease} />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  label,
  onPress,
  disabled,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
      <AppText style={styles.symbol}>{symbol}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  button: {
    width: layout.iconButtonSize,
    height: layout.iconButtonSize,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    color: colors.primary,
  },
  value: {
    minWidth: spacing.lg,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.3,
  },
});

import { Pressable, StyleSheet } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

// Small inline text button in the primary color.
export function TextLink({ label, onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => pressed && styles.pressed}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.primary,
  },
  pressed: {
    opacity: 0.6,
  },
});

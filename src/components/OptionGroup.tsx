import { Pressable, StyleSheet, View } from 'react-native';

import { colors, layout, radius, spacing } from '@/theme';

import { AppText } from './AppText';

type Option<T> = { value: T; label: string };

type Props<T> = {
  label: string;
  options: Option<T>[];
  isSelected: (value: T) => boolean;
  onPress: (value: T) => void;
  // Radio semantics for single-choice groups, checkbox for multi-choice.
  multiple?: boolean;
};

// A labeled row of selectable chips.
export function OptionGroup<T extends string | number>({
  label,
  options,
  isSelected,
  onPress,
  multiple = false,
}: Props<T>) {
  return (
    <View style={styles.group} accessibilityRole={multiple ? undefined : 'radiogroup'} accessibilityLabel={label}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <View style={styles.chips}>
        {options.map((o) => {
          const selected = isSelected(o.value);
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              aria-checked={selected}
              onPress={() => onPress(o.value)}
              style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}>
              <AppText style={{ color: selected ? colors.background : colors.text }}>{o.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: layout.buttonHeight,
    minWidth: layout.buttonHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
});

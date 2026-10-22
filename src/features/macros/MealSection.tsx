import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { FoodLog } from '@/db/foodLogs';
import { useUnits } from '@/features/settings/UnitsProvider';
import { sumMacros } from '@/lib/macros';
import { formatFoodMass } from '@/lib/units';
import { colors, layout, radius, spacing } from '@/theme';

type Props = {
  label: string;
  entries: FoodLog[];
  onDelete: (id: number) => void;
};

// One meal's logged foods with a calorie subtotal.
export function MealSection({ label, entries, onDelete }: Props) {
  const total = sumMacros(entries);
  const { units } = useUnits();
  return (
    <View style={styles.section}>
      <AppText variant="caption" muted>
        {label.toUpperCase()} · {Math.round(total.calories)} KCAL
      </AppText>
      {entries.map((e) => (
        <View key={e.id} style={styles.row}>
          <View style={styles.text}>
            <AppText>{e.foodName}</AppText>
            <AppText variant="caption" muted>
              {formatFoodMass(e.grams, units)} · {Math.round(e.calories)} kcal · P {Math.round(e.protein)} · C{' '}
              {Math.round(e.carbs)} · F {Math.round(e.fat)}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${e.foodName}`}
            onPress={() => onDelete(e.id)}
            style={styles.delete}>
            <AppText muted>×</AppText>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  delete: {
    width: layout.iconButtonSize,
    height: layout.iconButtonSize,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

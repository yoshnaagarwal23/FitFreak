import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OptionGroup } from '@/components/OptionGroup';
import { TextField } from '@/components/TextField';
import type { Food } from '@/db/foods';
import { useUnits } from '@/features/settings/UnitsProvider';
import {
  defaultMeal,
  macrosForGrams,
  MEAL_OPTIONS,
  parsePortion,
  type Meal,
  type PortionUnit,
} from '@/lib/macros';
import { formatFoodMass, gToOz } from '@/lib/units';
import { spacing } from '@/theme';

type Props = {
  food: Food;
  onAdd: (grams: number, meal: Meal) => Promise<void>;
};

// Choose how much of a food and which meal, with a live macro preview.
export function PortionPicker({ food, onAdd }: Props) {
  const { units } = useUnits();
  const massOption: PortionUnit = units === 'imperial' ? 'ounces' : 'grams';
  const [unit, setUnit] = useState<PortionUnit>('serving');
  const [amount, setAmount] = useState('1');
  const [meal, setMeal] = useState<Meal>(() => defaultMeal());
  const [saving, setSaving] = useState(false);

  const parsed = parsePortion(amount, unit, food.servingGrams);
  const preview = parsed.ok ? macrosForGrams(food.per100g, parsed.value) : null;

  // Keep the same quantity when switching units.
  const switchUnit = (next: PortionUnit) => {
    if (next === unit) return;
    if (parsed.ok) {
      const g = parsed.value;
      const amountIn = { grams: Math.round(g), ounces: +gToOz(g).toFixed(1), serving: +(g / food.servingGrams).toFixed(2) };
      setAmount(String(amountIn[next]));
    }
    setUnit(next);
  };

  const add = async () => {
    if (!parsed.ok) return;
    setSaving(true);
    try {
      await onAdd(parsed.value, meal);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.card}>
      <AppText>{food.name}</AppText>
      <OptionGroup
        label="Measure in"
        options={[
          { value: 'serving' as const, label: `${food.servingLabel} (${formatFoodMass(food.servingGrams, units)})` },
          { value: massOption, label: massOption === 'ounces' ? 'Ounces' : 'Grams' },
        ]}
        isSelected={(v) => v === unit}
        onPress={switchUnit}
      />
      <TextField
        label={unit === 'serving' ? 'Servings' : unit === 'ounces' ? 'Ounces' : 'Grams'}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        onSubmitEditing={add}
      />
      <OptionGroup label="Meal" options={MEAL_OPTIONS} isSelected={(v) => v === meal} onPress={setMeal} />

      {preview && parsed.ok ? (
        <AppText variant="caption" muted>
          {formatFoodMass(parsed.value, units)} · {Math.round(preview.calories)} kcal · P {Math.round(preview.protein)} g · C{' '}
          {Math.round(preview.carbs)} g · F {Math.round(preview.fat)} g
        </AppText>
      ) : (
        <AppText variant="caption">{!parsed.ok ? parsed.error : ''}</AppText>
      )}

      <View style={styles.action}>
        <Button
          label={`Add to ${MEAL_OPTIONS.find((m) => m.value === meal)?.label.toLowerCase()}`}
          onPress={add}
          disabled={!parsed.ok || saving}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  action: {
    alignItems: 'flex-start',
  },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useDb } from '@/db/supabase';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { createFood } from '@/db/foods';
import { parseCustomFood } from '@/lib/macros';
import { spacing } from '@/theme';

// Add a food from a nutrition label (values per 100 g).
export default function CustomFoodScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const db = useDb();
  const [draft, setDraft] = useState({
    name: params.name ?? '',
    servingLabel: '1 serving',
    servingGrams: '100',
    protein: '',
    carbs: '',
    fat: '',
  });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof draft) => (text: string) => setDraft((d) => ({ ...d, [key]: text }));
  const parsed = parseCustomFood(draft);

  const save = async () => {
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const id = await createFood(db, parsed.value);
    if (id === null) {
      setError(`“${parsed.value.name}” already exists — search for it instead.`);
      return;
    }
    router.back();
  };

  return (
    <Screen subtitle="Copy the per-100 g values from the label. Calories are calculated from the macros.">
      <TextField label="Name" value={draft.name} onChangeText={set('name')} placeholder="e.g. Amul high-protein curd" />
      <View style={styles.row}>
        <TextField label="Serving name" value={draft.servingLabel} onChangeText={set('servingLabel')} style={styles.field} />
        <TextField
          label="Serving size (g)"
          value={draft.servingGrams}
          onChangeText={set('servingGrams')}
          keyboardType="decimal-pad"
          style={styles.field}
        />
      </View>
      <View style={styles.row}>
        <TextField label="Protein /100 g" value={draft.protein} onChangeText={set('protein')} keyboardType="decimal-pad" style={styles.field} />
        <TextField label="Carbs /100 g" value={draft.carbs} onChangeText={set('carbs')} keyboardType="decimal-pad" style={styles.field} />
        <TextField label="Fat /100 g" value={draft.fat} onChangeText={set('fat')} keyboardType="decimal-pad" style={styles.field} />
      </View>

      <AppText variant="caption" muted>
        {parsed.ok ? `${parsed.value.per100g.calories} kcal per 100 g` : 'Fill in all fields to see calories'}
      </AppText>
      {error ? <AppText variant="caption">{error}</AppText> : null}

      <Button label="Save food" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
  },
});

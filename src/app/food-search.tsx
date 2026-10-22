import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { AppText } from '@/components/AppText';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { logFood } from '@/db/foodLogs';
import { searchFoods, type Food } from '@/db/foods';
import { PortionPicker } from '@/features/macros/PortionPicker';
import { useUnits } from '@/features/settings/UnitsProvider';
import { macrosForGrams } from '@/lib/macros';
import { formatFoodMass } from '@/lib/units';

// Modal: search foods, pick one, choose a portion, log it.
export default function FoodSearchScreen() {
  const db = useSQLiteContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const { units } = useUnits();

  // Re-run on focus too, so a just-created custom food shows up.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      searchFoods(db, query).then((rows) => {
        if (!cancelled) setResults(rows);
      });
      return () => {
        cancelled = true;
      };
    }, [db, query]),
  );

  const trimmed = query.trim();

  return (
    <Screen>
      {selected ? (
        <PortionPicker
          key={selected.id}
          food={selected}
          onAdd={async (grams, meal) => {
            await logFood(db, selected, grams, meal);
            router.back();
          }}
        />
      ) : null}

      <TextField
        label="Search foods"
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. dal, paneer, roti"
        autoFocus
        autoCorrect={false}
      />

      {results.map((food) => {
        const serving = macrosForGrams(food.per100g, food.servingGrams);
        return (
          <ListRow
            key={food.id}
            title={food.name}
            detail={`${food.servingLabel} (${formatFoodMass(food.servingGrams, units)}) · ${Math.round(serving.calories)} kcal · ${Math.round(serving.protein)} g protein`}
            trailing={food.vegetarian ? undefined : 'non-veg'}
            onPress={() => setSelected(food)}
          />
        );
      })}

      {trimmed && results.length === 0 ? <AppText muted>No matches for “{trimmed}”.</AppText> : null}

      <ListRow
        title="Create a custom food"
        detail="Enter values from a nutrition label"
        onPress={() => router.push({ pathname: '/custom-food', params: { name: trimmed } })}
      />

      <AppText variant="caption" muted>
        Built-in values are approximate (USDA, IFCT 2017, and typical home recipes).
      </AppText>
    </Screen>
  );
}

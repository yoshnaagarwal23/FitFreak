import { router } from 'expo-router';
import { useDb } from '@/db/supabase';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { OptionGroup } from '@/components/OptionGroup';
import { Screen } from '@/components/Screen';
import { getActiveSplit, saveSplit } from '@/db/splits';
import { PlanPreview } from '@/features/split/PlanPreview';
import {
  DEFAULT_INPUTS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  generateSplit,
  GOAL_OPTIONS,
  MAX_DAYS,
  MIN_DAYS,
  type GymEquipment,
  type SplitInputs,
} from '@/lib/split';

const DAY_OPTIONS = Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => ({
  value: MIN_DAYS + i,
  label: String(MIN_DAYS + i),
}));

// Split builder: pick inputs, preview the generated plan live, save it.
export default function SplitScreen() {
  const db = useDb();
  const [inputs, setInputs] = useState<SplitInputs>(DEFAULT_INPUTS);
  const [saving, setSaving] = useState(false);

  // Start from the current split's inputs when editing.
  useEffect(() => {
    getActiveSplit(db).then((split) => {
      if (split) setInputs(split.inputs);
    });
  }, [db]);

  const plan = generateSplit(inputs);
  const update = (patch: Partial<SplitInputs>) => setInputs((prev) => ({ ...prev, ...patch }));

  const toggleEquipment = (value: GymEquipment) =>
    update({
      equipment: inputs.equipment.includes(value)
        ? inputs.equipment.filter((e) => e !== value)
        : [...inputs.equipment, value],
    });

  const save = async () => {
    setSaving(true);
    try {
      await saveSplit(db, inputs, plan);
      if (router.canGoBack()) router.back();
      else router.replace('/workouts');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen subtitle="Answer four questions — the plan updates as you go.">
      <OptionGroup
        label="Goal"
        options={GOAL_OPTIONS}
        isSelected={(v) => v === inputs.goal}
        onPress={(goal) => update({ goal })}
      />
      <OptionGroup
        label="Days per week"
        options={DAY_OPTIONS}
        isSelected={(v) => v === inputs.daysPerWeek}
        onPress={(daysPerWeek) => update({ daysPerWeek })}
      />
      <OptionGroup
        label="Experience"
        options={EXPERIENCE_OPTIONS}
        isSelected={(v) => v === inputs.experience}
        onPress={(experience) => update({ experience })}
      />
      <OptionGroup
        label="Equipment (bodyweight always included)"
        options={EQUIPMENT_OPTIONS}
        isSelected={(v) => inputs.equipment.includes(v)}
        onPress={toggleEquipment}
        multiple
      />

      <PlanPreview plan={plan} />

      <Button label="Save split" onPress={save} disabled={saving} />
    </Screen>
  );
}

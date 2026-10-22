import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/TextField';
import type { BodyDraft } from '@/lib/macros';
import type { UnitSystem } from '@/lib/units';
import { spacing } from '@/theme';

type Props = {
  draft: BodyDraft;
  units: UnitSystem;
  onChange: (patch: Partial<BodyDraft>) => void;
};

// Age, height, and weight inputs in the user's unit system.
export function BodyStatsFields({ draft, units, onChange }: Props) {
  return (
    <View style={styles.row}>
      <TextField
        label="Age"
        value={draft.age}
        onChangeText={(age) => onChange({ age })}
        keyboardType="number-pad"
        style={styles.field}
      />
      {units === 'metric' ? (
        <>
          <TextField
            label="Height (cm)"
            value={draft.heightCm}
            onChangeText={(heightCm) => onChange({ heightCm })}
            keyboardType="decimal-pad"
            style={styles.field}
          />
          <TextField
            label="Weight (kg)"
            value={draft.weightKg}
            onChangeText={(weightKg) => onChange({ weightKg })}
            keyboardType="decimal-pad"
            style={styles.field}
          />
        </>
      ) : (
        <>
          <TextField
            label="Height (ft)"
            value={draft.heightFt}
            onChangeText={(heightFt) => onChange({ heightFt })}
            keyboardType="number-pad"
            style={styles.field}
          />
          <TextField
            label="(in)"
            accessibilityLabel="Height (in)"
            value={draft.heightIn}
            onChangeText={(heightIn) => onChange({ heightIn })}
            keyboardType="decimal-pad"
            style={styles.field}
          />
          <TextField
            label="Weight (lb)"
            value={draft.weightLb}
            onChangeText={(weightLb) => onChange({ weightLb })}
            keyboardType="decimal-pad"
            style={styles.field}
          />
        </>
      )}
    </View>
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

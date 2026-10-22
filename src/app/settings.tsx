import { AppText } from '@/components/AppText';
import { OptionGroup } from '@/components/OptionGroup';
import { Screen } from '@/components/Screen';
import { useUnits } from '@/features/settings/UnitsProvider';
import { UNIT_OPTIONS } from '@/lib/units';

export default function SettingsScreen() {
  const { units, setUnits } = useUnits();

  return (
    <Screen>
      <OptionGroup label="Units" options={UNIT_OPTIONS} isSelected={(v) => v === units} onPress={setUnits} />
      <AppText variant="caption" muted>
        Applies to body weight and height, lifting weights, food portions, and water. Macros stay in grams. Your
        data is stored the same way either way, so switching never changes your history.
      </AppText>
    </Screen>
  );
}

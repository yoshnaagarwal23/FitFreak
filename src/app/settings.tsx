import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OptionGroup } from '@/components/OptionGroup';
import { Screen } from '@/components/Screen';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { LocalImportCard } from '@/features/settings/LocalImportCard';
import { useUnits } from '@/features/settings/UnitsProvider';
import { UNIT_OPTIONS } from '@/lib/units';

export default function SettingsScreen() {
  const { units, setUnits } = useUnits();
  const { session } = useAuth();

  return (
    <Screen>
      <OptionGroup label="Units" options={UNIT_OPTIONS} isSelected={(v) => v === units} onPress={setUnits} />
      <AppText variant="caption" muted>
        Applies to body weight and height, lifting weights, food portions, and water. Macros stay in grams. Your
        data is stored the same way either way, so switching never changes your history.
      </AppText>

      <LocalImportCard />

      <Card>
        <AppText variant="caption" muted>
          Signed in as
        </AppText>
        <AppText>{session?.user.email}</AppText>
      </Card>
      <Button label="Log out" variant="secondary" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}

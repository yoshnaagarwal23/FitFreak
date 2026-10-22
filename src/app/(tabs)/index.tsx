import { router } from 'expo-router';

import { Screen } from '@/components/Screen';
import { TextLink } from '@/components/TextLink';
import { MacroSummary } from '@/features/macros/MacroSummary';
import { useMacroDay } from '@/features/macros/useMacroDay';
import { WaterCard } from '@/features/water/WaterCard';

export default function TodayScreen() {
  const { data } = useMacroDay();

  return (
    <Screen
      title="Today"
      subtitle="Your water, macros, and workout at a glance."
      action={<TextLink label="Settings" onPress={() => router.push('/settings')} />}>
      <WaterCard />
      {data ? <MacroSummary targets={data.targets} totals={data.totals} /> : null}
    </Screen>
  );
}

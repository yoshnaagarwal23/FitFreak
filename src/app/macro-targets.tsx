import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OptionGroup } from '@/components/OptionGroup';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { getMacroSettings, saveMacroSettings } from '@/db/macroSettings';
import { BodyStatsFields } from '@/features/macros/BodyStatsFields';
import { useUnits } from '@/features/settings/UnitsProvider';
import {
  ACTIVITY_OPTIONS,
  BODY_GOAL_OPTIONS,
  DEFAULT_ACTIVITY,
  calculateTargets,
  manualTargets,
  bodyDraftFrom,
  EMPTY_BODY_DRAFT,
  parseBodyDraft,
  parseManualMacros,
  SEX_OPTIONS,
  type Activity,
  type BodyDraft,
  type BodyGoal,
  type Macros,
  type Sex,
} from '@/lib/macros';
import { UNIT_OPTIONS, type UnitSystem } from '@/lib/units';
import { spacing } from '@/theme';

type Mode = 'auto' | 'manual';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'auto', label: 'Calculate for me' },
  { value: 'manual', label: 'Enter my own' },
];

export default function MacroTargetsScreen() {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<Mode>('auto');
  const [sex, setSex] = useState<Sex>('female');
  const [activity, setActivity] = useState<Activity>(DEFAULT_ACTIVITY);
  const [goal, setGoal] = useState<BodyGoal>('maintain');
  const { units, setUnits } = useUnits();
  const [body, setBody] = useState<BodyDraft>(EMPTY_BODY_DRAFT);
  const [manual, setManual] = useState({ protein: '', carbs: '', fat: '' });

  // Prefill from saved settings.
  useEffect(() => {
    getMacroSettings(db).then((s) => {
      if (!s) return;
      setMode(s.mode);
      if (s.profile) {
        setSex(s.profile.sex);
        setActivity(s.profile.activity);
        setGoal(s.profile.goal);
        setBody(bodyDraftFrom(s.profile));
      }
      if (s.manual) {
        setManual({
          protein: String(s.manual.protein),
          carbs: String(s.manual.carbs),
          fat: String(s.manual.fat),
        });
      }
    });
  }, [db]);

  const profile = parseBodyDraft(body, units, { sex, activity, goal });
  const manualParsed = parseManualMacros(manual);
  const auto = profile.ok ? calculateTargets(profile.value, units) : null;

  // Carry valid values across when switching units, so the other fields aren't blank.
  const changeUnits = async (next: UnitSystem) => {
    if (profile.ok) setBody(bodyDraftFrom(profile.value));
    await setUnits(next);
  };
  const result: Macros | null =
    mode === 'auto' ? (auto?.targets ?? null) : manualParsed.ok ? manualTargets(manualParsed.value) : null;
  const error = mode === 'auto' ? (!profile.ok ? profile.error : null) : !manualParsed.ok ? manualParsed.error : null;

  const save = async () => {
    if (!result) return;
    await saveMacroSettings(db, {
      mode,
      profile: profile.ok ? profile.value : null,
      manual: manualParsed.ok ? manualParsed.value : null,
    });
    if (router.canGoBack()) router.back();
    else router.replace('/meals');
  };

  return (
    <Screen>
      <OptionGroup label="Targets" options={MODE_OPTIONS} isSelected={(v) => v === mode} onPress={setMode} />

      {mode === 'auto' ? (
        <>
          <OptionGroup label="Sex (used by the BMR formula)" options={SEX_OPTIONS} isSelected={(v) => v === sex} onPress={setSex} />
          <OptionGroup label="Units" options={UNIT_OPTIONS} isSelected={(v) => v === units} onPress={changeUnits} />
          <BodyStatsFields draft={body} units={units} onChange={(patch) => setBody((b) => ({ ...b, ...patch }))} />
          <OptionGroup label="Activity" options={ACTIVITY_OPTIONS} isSelected={(v) => v === activity} onPress={setActivity} />
          <AppText variant="caption" muted>
            {ACTIVITY_OPTIONS.find((a) => a.value === activity)?.description} Think of a typical week; if
            you’re between two levels, pick the lower one.
          </AppText>
          <OptionGroup label="Goal" options={BODY_GOAL_OPTIONS} isSelected={(v) => v === goal} onPress={setGoal} />
        </>
      ) : (
        <View style={styles.row}>
          <TextField label="Protein (g)" value={manual.protein} onChangeText={(protein) => setManual((m) => ({ ...m, protein }))} keyboardType="decimal-pad" style={styles.field} />
          <TextField label="Carbs (g)" value={manual.carbs} onChangeText={(carbs) => setManual((m) => ({ ...m, carbs }))} keyboardType="decimal-pad" style={styles.field} />
          <TextField label="Fat (g)" value={manual.fat} onChangeText={(fat) => setManual((m) => ({ ...m, fat }))} keyboardType="decimal-pad" style={styles.field} />
        </View>
      )}

      {result ? (
        <Card>
          <AppText>
            {result.calories} kcal · P {result.protein} g · C {result.carbs} g · F {result.fat} g
          </AppText>
          {mode === 'auto' && auto
            ? auto.steps.map((step) => (
                <AppText key={step} variant="caption" muted>
                  • {step}
                </AppText>
              ))
            : (
                <AppText variant="caption" muted>
                  Calories = 4 × protein + 4 × carbs + 9 × fat
                </AppText>
              )}
          {mode === 'auto' ? (
            <AppText variant="caption">
              This is an estimate. Check your weight trend after 2–3 weeks: if it’s moving the wrong way, adjust by
              about 150–200 kcal or change your activity level.
            </AppText>
          ) : null}
        </Card>
      ) : (
        <AppText variant="caption" muted>
          {error}
        </AppText>
      )}

      <Button label="Save targets" onPress={save} disabled={!result} />
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

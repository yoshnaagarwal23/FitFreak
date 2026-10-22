import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { spacing } from '@/theme';

// Meals tab entry point for the AI planner.
export function MealPlannerCard({ hasTargets }: { hasTargets: boolean }) {
  return (
    <Card>
      <AppText>AI meal planner</AppText>
      <AppText variant="caption" muted>
        {hasTargets
          ? 'Get vegetarian, Indian-friendly meals that fit your macro targets.'
          : 'Set your macro targets first — the planner aims for them.'}
      </AppText>
      <View style={styles.action}>
        <Button
          label="Plan meals"
          variant="secondary"
          onPress={() => router.push('/meal-plan')}
          disabled={!hasTargets}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
});

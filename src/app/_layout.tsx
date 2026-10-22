import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { UnitsProvider } from '@/features/settings/UnitsProvider';
import { colors, typography } from '@/theme';

// Root stack: the tab navigator plus screens pushed on top of it.
export default function RootLayout() {
  return (
    <DatabaseProvider>
      <UnitsProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: {
            fontFamily: typography.body.fontFamily,
            fontSize: typography.body.fontSize,
            fontWeight: '600',
            color: colors.text,
          },
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]" options={{ headerShown: true, title: 'Workout' }} />
        <Stack.Screen name="exercise/[id]" options={{ headerShown: true, title: 'Exercise' }} />
        <Stack.Screen name="split" options={{ headerShown: true, title: 'Build your split' }} />
        <Stack.Screen name="split-edit" options={{ headerShown: true, title: 'Edit split' }} />
        <Stack.Screen name="split-day/[id]" options={{ headerShown: true, title: 'Edit day' }} />
        <Stack.Screen name="macro-targets" options={{ headerShown: true, title: 'Macro targets' }} />
        <Stack.Screen name="custom-food" options={{ headerShown: true, title: 'Custom food' }} />
        <Stack.Screen name="meal-plan" options={{ headerShown: true, title: 'AI meal planner' }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        <Stack.Screen
          name="food-search"
          options={{ headerShown: true, title: 'Log food', presentation: 'modal' }}
        />
        <Stack.Screen
          name="exercise-picker"
          options={{ headerShown: true, title: 'Add exercise', presentation: 'modal' }}
        />
      </Stack>
      </UnitsProvider>
    </DatabaseProvider>
  );
}

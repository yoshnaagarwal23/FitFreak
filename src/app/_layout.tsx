import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { UnitsProvider } from '@/features/settings/UnitsProvider';
import { colors, typography } from '@/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootStack />
    </AuthProvider>
  );
}

// Root stack: the tab navigator plus screens pushed on top of it. Signed-out visitors
// only get the sign-in screen; someone who opened a reset link must set a password first.
function RootStack() {
  const { session, recovering } = useAuth();
  if (session === undefined) return null; // reading the stored session; takes a moment
  const signedIn = session !== null;

  return (
    // Keyed by user so nothing cached for one account is shown to the next.
    <UnitsProvider key={session?.user.id ?? 'signed-out'}>
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
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && recovering}>
          <Stack.Screen name="new-password" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !recovering}>
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
        </Stack.Protected>
      </Stack>
    </UnitsProvider>
  );
}

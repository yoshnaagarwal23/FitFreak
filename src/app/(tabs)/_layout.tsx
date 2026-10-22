import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';

import { TabIcon } from '@/components/TabIcon';
import { colors, layout, typography } from '@/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // Keep the tab bar's own label size — it sizes the label box for it, and larger text gets clipped.
        tabBarLabelStyle: {
          fontFamily: typography.caption.fontFamily,
          fontWeight: typography.caption.fontWeight,
        },
        tabBarStyle: {
          // Web only: on iOS the default height already includes the home-indicator inset.
          height: Platform.OS === 'web' ? layout.tabBarHeight : undefined,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'sun.max', android: 'today', web: 'today' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' }}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Meals',
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{
                ios: 'chart.line.uptrend.xyaxis',
                android: 'trending_up',
                web: 'trending_up',
              }}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

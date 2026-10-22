import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme';

import { AppText } from './AppText';

type Props = {
  // Omit on stack screens — the navigation header shows the title there.
  title?: string;
  subtitle?: string;
  // Small control shown to the right of the title (e.g. a settings link).
  action?: ReactNode;
  children?: ReactNode;
};

export function Screen({ title, subtitle, action, children }: Props) {
  return (
    <SafeAreaView
      style={styles.safe}
      // With a navigation header, the header already handles the top inset.
      edges={title ? ['top', 'left', 'right'] : ['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {title || subtitle ? (
            <View style={styles.header}>
              {title ? (
                <View style={styles.titleRow}>
                  <AppText variant="title">{title}</AppText>
                  {action}
                </View>
              ) : null}
              {subtitle ? <AppText muted>{subtitle}</AppText> : null}
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

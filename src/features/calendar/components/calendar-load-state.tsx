import { Spacing, Typography } from '@/constants/theme';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatabaseErrorState } from '@/shared/components/database-error-state';
import { useTheme } from '@/hooks/use-theme';

export type CalendarLoadStateProps = Readonly<{
  status: 'loading' | 'ready' | 'error';
  onRetry(): void;
  children: ReactNode;
}>;

export function CalendarLoadState({ status, onRetry, children }: CalendarLoadStateProps) {
  const theme = useTheme();

  if (status === 'loading') {
    return (
      <SafeAreaView accessibilityRole="progressbar" accessibilityLabel="カレンダーを読み込んでいます" style={styles.loading}>
        <ActivityIndicator color={theme.calendarAccent} />
        <Text style={[styles.loadingLabel, { color: theme.textSecondary }]}>カレンダーを読み込んでいます</Text>
      </SafeAreaView>
    );
  }

  if (status === 'error') return <DatabaseErrorState onRetry={onRetry} />;

  return <View style={styles.ready}>{children}</View>;
}

const styles = StyleSheet.create({
  ready: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.twelve, padding: Spacing.four },
  loadingLabel: { fontSize: Typography.row },
});

import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
      <View accessibilityRole="progressbar" accessibilityLabel="カレンダーを読み込んでいます" style={styles.loading}>
        <ActivityIndicator color={theme.calendarAccent} />
        <Text style={[styles.loadingLabel, { color: theme.textSecondary }]}>カレンダーを読み込んでいます</Text>
      </View>
    );
  }

  if (status === 'error') return <DatabaseErrorState onRetry={onRetry} />;

  return <View>{children}</View>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingLabel: { fontSize: 15 },
});

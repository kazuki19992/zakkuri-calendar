import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DayCalendarState } from '../hooks/use-day-calendar';
import { SelectedDayAgenda } from '../components/selected-day-agenda';
import { useTheme } from '@/hooks/use-theme';

export function DayCalendarScreen({ date, state, onEditEvent, isPreview = false }: Readonly<{
  date: string;
  state: DayCalendarState;
  onEditEvent?(id: string, occurrenceDate?: string): void;
  isPreview?: boolean;
}>) {
  const theme = useTheme();
  if (state.status === 'loading') return <View style={styles.center}><ActivityIndicator /></View>;
  if (state.status === 'error') return <View style={styles.center}><Text style={{ color: theme.text }}>予定を読み込めませんでした</Text><Pressable accessibilityRole="button" accessibilityLabel="再試行" onPress={state.retry}><Text style={{ color: theme.calendarAccent }}>再試行</Text></Pressable></View>;
  return <ScrollView contentContainerStyle={styles.content}><SelectedDayAgenda selectedDate={date} holidayName={state.holidayName} holidaySupport="available" items={state.items}
    onEditEvent={isPreview ? undefined : onEditEvent} /></ScrollView>;
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, content: { flexGrow: 1 } });

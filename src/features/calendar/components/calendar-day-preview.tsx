import { Spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';
import type { CalendarSnapshotInput } from '../calendar-snapshot';
import { useDayCalendar } from '../hooks/use-day-calendar';
import { DayCalendarScreen } from '../screens/day-calendar-screen';

export function CalendarDayPreview({ date, input }: Readonly<{
  date: string;
  input: CalendarSnapshotInput & Readonly<{ refreshRevision?: number }>;
}>) {
  const state = useDayCalendar({ ...input, date });

  return <View testID="calendar-day-preview" style={styles.container}>
    <DayCalendarScreen date={date} state={state} isPreview />
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: Spacing.twelve } });

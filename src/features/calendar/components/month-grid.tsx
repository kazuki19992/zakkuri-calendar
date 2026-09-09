import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { MonthDayViewModel } from '../month-view-model';
import { MonthDayCell } from './month-day-cell';

const weekdayLabels = ['月', '火', '水', '木', '金', '土', '日'] as const;

export type MonthGridProps = Readonly<{
  days: readonly MonthDayViewModel[];
  onSelectDate(date: string): void;
}>;

export function MonthGrid({ days, onSelectDate }: MonthGridProps) {
  const theme = useTheme();
  const weeks = Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  return (
    <View testID="month-calendar">
      <View style={[styles.weekdays, { borderBottomColor: theme.calendarBorder }] }>
        {weekdayLabels.map((label, index) => (
          <Text key={label} testID="month-calendar.weekday" accessibilityLabel={`${label}曜日`}
            style={[styles.weekday, { color: theme.textSecondary }, index === 5 && { color: theme.calendarSaturday }, index === 6 && { color: theme.calendarHoliday }]}>
            {label}
          </Text>
        ))}
      </View>
      {weeks.map((week, index) => (
        <View key={index} testID="month-calendar.week" style={styles.week}>
          {week.map((day) => <MonthDayCell key={day.date} day={day} onPress={onSelectDate} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  weekdays: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  week: { flexDirection: 'row' },
});

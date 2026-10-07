import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { MonthDayViewModel, MonthWeekViewModel } from '../month-view-model';
import { MonthDayCell } from './month-day-cell';
import { MonthWeekEventLayer } from './month-week-event-layer';

const weekdayLabels = ['月', '火', '水', '木', '金', '土', '日'] as const;

export type MonthGridProps = Readonly<{
  days: readonly MonthDayViewModel[];
  onSelectDate(date: string): void;
  weekModels?: readonly MonthWeekViewModel[];
  onOpenDay?(date: string): void;
  onEditEvent?(id: string, originalOccurrenceDate?: string): void;
  variant?: 'month' | 'picker';
}>;

export function MonthGrid({ days, onSelectDate, weekModels, onOpenDay, onEditEvent, variant = 'month' }: MonthGridProps) {
  const theme = useTheme();
  const dayWeeks = Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  return (
    <View testID="month-calendar" style={variant === 'month' ? styles.monthGrid : undefined}>
      <View style={[styles.weekdays, { borderBottomColor: theme.calendarBorder }] }>
        {weekdayLabels.map((label, index) => (
          <Text key={label} testID="month-calendar.weekday" accessibilityLabel={`${label}曜日`}
            style={[styles.weekday, variant === 'picker' && styles.pickerWeekday, { color: theme.textSecondary }, index === 5 && { color: theme.calendarSaturday }, index === 6 && { color: theme.calendarHoliday }]}>
            {label}
          </Text>
        ))}
      </View>
      {dayWeeks.map((week, index) => (
        <View key={index} testID="month-calendar.week" style={[styles.week, variant === 'month' && styles.monthWeek]}>
          {week.map((day) => <MonthDayCell key={day.date} day={day} variant={variant} onPress={onSelectDate} onOpenDay={onOpenDay} />)}
          {variant === 'month' && onOpenDay !== undefined && weekModels?.[index] !== undefined ? <MonthWeekEventLayer week={weekModels[index]} onOpenDay={onOpenDay} onEditEvent={onEditEvent} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  weekdays: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '500' },
  pickerWeekday: { fontSize: 11 },
  week: { flexDirection: 'row' },
  monthGrid: { alignSelf: 'stretch', flex: 1, width: '100%' },
  monthWeek: { flex: 1, position: 'relative' },
});

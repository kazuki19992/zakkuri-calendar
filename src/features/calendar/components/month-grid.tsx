import { Spacing, Typography } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { MonthDayViewModel, MonthWeekViewModel } from '../month-view-model';
import { MONTH_DAY_HEADER_HEIGHT, MONTH_HOLIDAY_LINE_HEIGHT, MonthDayCell } from './month-day-cell';
import type { SavedCalendarEvent } from '../calendar-refresh-context';
import { MonthWeekEventLayer } from './month-week-event-layer';
import type { ReactNode } from 'react';

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'] as const;

export type MonthGridProps = Readonly<{
  days: readonly MonthDayViewModel[];
  onSelectDate(date: string): void;
  weekModels?: readonly MonthWeekViewModel[];
  onOpenDay?(date: string): void;
  onEditEvent?(id: string, originalOccurrenceDate?: string): void;
  variant?: 'month' | 'picker';
  renderDayPreview?(date: string): ReactNode;
  savedEvent?: SavedCalendarEvent | null;
}>;

export function MonthGrid({ days, onSelectDate, weekModels, onOpenDay, onEditEvent, renderDayPreview, savedEvent, variant = 'month' }: MonthGridProps) {
  const theme = useTheme();
  const firstWeekday = days[0]?.weekday ?? 1;
  const weekdays = Array.from({ length: 7 }, (_, index) => (firstWeekday + index) % 7);
  const dayWeeks = Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  return (
    <View testID="month-calendar" style={variant === 'month' ? styles.monthGrid : undefined}>
      <View style={[styles.weekdays, { borderBottomColor: theme.calendarBorder }, variant === 'month' && { backgroundColor: theme.backgroundElement }] }>
        {weekdays.map((weekday) => (
          <Text key={weekday} testID="month-calendar.weekday" accessibilityLabel={`${weekdayLabels[weekday]}曜日`}
            style={[styles.weekday, variant === 'picker' && styles.pickerWeekday, { color: theme.textSecondary }, weekday === 6 && { color: theme.calendarSaturday }, weekday === 0 && { color: theme.calendarHoliday }]}>
            {weekdayLabels[weekday]}
          </Text>
        ))}
      </View>
      {dayWeeks.map((week, index) => (
        <View key={index} testID="month-calendar.week" style={[styles.week, variant === 'month' && [styles.monthWeek, { borderColor: theme.controlBorder }]]}>
          {week.map((day) => <MonthDayCell key={day.date} day={day} variant={variant} onPress={onSelectDate} onOpenDay={onOpenDay} renderDayPreview={renderDayPreview} />)}
          {variant === 'month' && onOpenDay !== undefined && weekModels?.[index] !== undefined ? <MonthWeekEventLayer week={weekModels[index]} onOpenDay={onOpenDay} onEditEvent={onEditEvent}
            savedEvent={savedEvent} headerHeight={MONTH_DAY_HEADER_HEIGHT
              + (week.some((day) => day.holidayName !== null) ? MONTH_HOLIDAY_LINE_HEIGHT : 0)} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  weekdays: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.two },
  weekday: { flex: 1, textAlign: 'center', fontSize: Typography.caption, fontWeight: '400' },
  pickerWeekday: { fontSize: Typography.caption },
  week: { flexDirection: 'row' },
  monthGrid: { alignSelf: 'stretch', flex: 1, width: '100%' },
  monthWeek: { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth },
});

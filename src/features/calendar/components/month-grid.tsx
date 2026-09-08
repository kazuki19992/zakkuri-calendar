import { forwardRef } from 'react';
import { Calendar, type CalendarProps } from 'react-native-calendars';
import type { MonthDayViewModel } from '../month-view-model';
import { useTheme } from '@/hooks/use-theme';
import { MonthDayCell } from './month-day-cell';
import { MonthToolbar, type MonthToolbarHandle } from './month-toolbar';

export type MonthGridProps = Readonly<{
  visibleMonth: string;
  days: readonly MonthDayViewModel[];
  onSelectDate(date: string): void;
  onVisibleMonthChange?(date: string): void;
  onPreviousMonth(): void;
  onToday(): void;
  onNextMonth(): void;
}>;

export function MonthGrid({
  visibleMonth,
  days,
  onSelectDate,
  onVisibleMonthChange,
  onPreviousMonth,
  onToday,
  onNextMonth,
}: MonthGridProps) {
  const theme = useTheme();
  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const CalendarHeader: NonNullable<CalendarProps['customHeader']> = forwardRef<
    MonthToolbarHandle,
    { addMonth?: (count: number) => void }
  >(function CalendarHeader({ addMonth }, ref) {
    return (
      <MonthToolbar
        ref={ref}
        visibleMonth={visibleMonth}
        onPreviousMonth={() => {
          addMonth?.(-1);
          onPreviousMonth();
        }}
        onToday={onToday}
        onNextMonth={() => {
          addMonth?.(1);
          onNextMonth();
        }}
      />
    );
  });
  const DayComponent: NonNullable<CalendarProps['dayComponent']> = ({ date }) => {
    const day = date === undefined ? undefined : daysByDate.get(date.dateString);
    return day === undefined ? null : <MonthDayCell day={day} onPress={onSelectDate} />;
  };

  return (
    <Calendar
      testID="month-calendar"
      initialDate={visibleMonth}
      firstDay={1}
      showSixWeeks
      hideExtraDays={false}
      enableSwipeMonths
      customHeader={CalendarHeader}
      dayComponent={DayComponent}
      onMonthChange={(date) => {
        onVisibleMonthChange?.(`${date.dateString.slice(0, 7)}-01`);
      }}
      theme={{
        calendarBackground: theme.background,
        dayTextColor: theme.text,
        textDisabledColor: theme.textSecondary,
        textSectionTitleColor: theme.textSecondary,
      }}
    />
  );
}

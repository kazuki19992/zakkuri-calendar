import { Calendar, type CalendarProps } from 'react-native-calendars';
import type { MonthDayViewModel } from '../month-view-model';
import { useTheme } from '@/hooks/use-theme';
import { MonthDayCell } from './month-day-cell';
import { MonthToolbar } from './month-toolbar';

export type MonthGridProps = Readonly<{
  visibleMonth: string;
  days: readonly MonthDayViewModel[];
  onSelectDate(date: string): void;
  onPreviousMonth(): void;
  onToday(): void;
  onNextMonth(): void;
}>;

export function MonthGrid({
  visibleMonth,
  days,
  onSelectDate,
  onPreviousMonth,
  onToday,
  onNextMonth,
}: MonthGridProps) {
  const theme = useTheme();
  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const CalendarHeader: NonNullable<CalendarProps['customHeader']> = () => (
    <MonthToolbar
      visibleMonth={visibleMonth}
      onPreviousMonth={onPreviousMonth}
      onToday={onToday}
      onNextMonth={onNextMonth}
    />
  );
  const DayComponent: NonNullable<CalendarProps['dayComponent']> = ({ date }) => {
    const day = date === undefined ? undefined : daysByDate.get(date.dateString);
    return day === undefined ? null : <MonthDayCell day={day} onPress={onSelectDate} />;
  };

  return (
    <Calendar
      initialDate={visibleMonth}
      firstDay={1}
      showSixWeeks
      hideExtraDays={false}
      enableSwipeMonths
      customHeader={CalendarHeader}
      dayComponent={DayComponent}
      onMonthChange={(date) => {
        if (date.dateString.slice(0, 7) !== visibleMonth.slice(0, 7)) onSelectDate(date.dateString);
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

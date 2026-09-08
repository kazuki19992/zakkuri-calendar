import { forwardRef, useMemo } from 'react';
import { Calendar, type CalendarProps } from 'react-native-calendars';
import { PanResponder, View, type PanResponderGestureState } from 'react-native';
import type { MonthDayViewModel } from '../month-view-model';
import { useTheme } from '@/hooks/use-theme';
import { MonthDayCell } from './month-day-cell';
import { MonthToolbar, type MonthToolbarHandle } from './month-toolbar';

const HORIZONTAL_SWIPE_DISTANCE = 40;
const HORIZONTAL_SWIPE_VELOCITY = 0.3;

function moveMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 10);
}

function isHorizontalSwipe(gesture: PanResponderGestureState): boolean {
  return (
    Math.abs(gesture.dx) >= HORIZONTAL_SWIPE_DISTANCE &&
    Math.abs(gesture.dx) > Math.abs(gesture.dy) &&
    Math.abs(gesture.vx) >= HORIZONTAL_SWIPE_VELOCITY
  );
}

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
  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) >= HORIZONTAL_SWIPE_DISTANCE &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (!isHorizontalSwipe(gesture)) return;
          const offset = gesture.dx < 0 ? 1 : -1;
          onVisibleMonthChange?.(moveMonth(visibleMonth, offset));
        },
      }),
    [onVisibleMonthChange, visibleMonth],
  );
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
    <View testID="month-calendar.swipe" {...swipeResponder.panHandlers}>
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
    </View>
  );
}

import { useMemo } from 'react';
import { Calendar, type CalendarProps } from 'react-native-calendars';
import { PanResponder, View, type PanResponderGestureState } from 'react-native';
import type { MonthDayViewModel } from '../month-view-model';
import { useTheme } from '@/hooks/use-theme';
import { MonthDayCell } from './month-day-cell';
import { MonthToolbar } from './month-toolbar';

const HORIZONTAL_SWIPE_DISTANCE = 40;
const HORIZONTAL_SWIPE_VELOCITY = 0.3;

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
  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) >= HORIZONTAL_SWIPE_DISTANCE &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (!isHorizontalSwipe(gesture)) return;
          if (gesture.dx < 0) onNextMonth();
          else onPreviousMonth();
        },
      }),
    [onNextMonth, onPreviousMonth],
  );
  const CalendarHeader: NonNullable<CalendarProps['customHeader']> = function CalendarHeader() {
    return (
      <MonthToolbar
        visibleMonth={visibleMonth}
        onPreviousMonth={onPreviousMonth}
        onToday={onToday}
        onNextMonth={onNextMonth}
      />
    );
  };
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
        customHeader={CalendarHeader}
        dayComponent={DayComponent}
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

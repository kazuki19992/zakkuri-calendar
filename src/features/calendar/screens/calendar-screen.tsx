import { Animated, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { CalendarLoadState } from '../components/calendar-load-state';
import { CalendarPeriodToolbar } from '../components/calendar-period-toolbar';
import { CalendarViewSwitcher } from '../components/calendar-view-switcher';
import { MonthGrid } from '../components/month-grid';
import { SelectedDayAgenda } from '../components/selected-day-agenda';
import { TwoDayView } from '../components/two-day-view';
import { useHorizontalSwipeTransition } from '../hooks/use-horizontal-swipe-transition';
import type { CalendarViewState } from '../hooks/use-calendar-view';

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}年${monthNumber}月`;
}

function formatTwoDayPeriod(from: string, through: string): string {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [throughYear, throughMonth, throughDay] = through.split('-').map(Number);
  if (fromYear === throughYear && fromMonth === throughMonth) {
    return `${fromYear}年${fromMonth}月${fromDay}日〜${throughDay}日`;
  }
  if (fromYear === throughYear) {
    return `${fromYear}年${fromMonth}月${fromDay}日〜${throughMonth}月${throughDay}日`;
  }
  return `${fromYear}年${fromMonth}月${fromDay}日〜${throughYear}年${throughMonth}月${throughDay}日`;
}

export function CalendarScreen({ state, onAddEvent }: Readonly<{
  state: CalendarViewState;
  onAddEvent(date: string): void;
}>) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const transition = useHorizontalSwipeTransition({
    onPrevious: state.showPreviousPeriod,
    onNext: state.showNextPeriod,
    reduceMotion,
  });
  const periodLabel = state.mode === 'twoDay'
    ? formatTwoDayPeriod(state.twoDayDays[0].date, state.twoDayDays[1].date)
    : formatMonth(state.visibleMonth);
  const previousLabel = state.mode === 'twoDay' ? '前の1日へ' : '前月へ';
  const nextLabel = state.mode === 'twoDay' ? '次の1日へ' : '次月へ';

  return (
    <CalendarLoadState status={state.status} onRetry={() => void state.retry()}>
      <ScrollView testID="calendar.scroll" style={[styles.scroll, { backgroundColor: theme.background }]}
        contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <CalendarViewSwitcher mode={state.mode} onSelectMode={(mode) => void state.selectMode(mode)} />
        <CalendarPeriodToolbar periodLabel={periodLabel} previousAccessibilityLabel={previousLabel}
          nextAccessibilityLabel={nextLabel} isLoading={state.isPeriodLoading || transition.isAnimating}
          onPrevious={() => void transition.movePrevious()} onToday={() => void state.showToday()}
          onNext={() => void transition.moveNext()} />
        {state.periodError !== null ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.calendarHoliday }]}>{state.periodError}</Text>
        ) : null}
        <Animated.View testID="calendar.animated-content" {...transition.panHandlers}
          onLayout={(event) => transition.onLayout(event.nativeEvent.layout.width)}
          style={{ transform: [{ translateX: transition.translateX }] }}>
          {state.mode === 'twoDay' ? (
            <TwoDayView days={state.twoDayDays} onAddEvent={onAddEvent} />
          ) : (
            <>
              <MonthGrid days={state.monthDays} onSelectDate={(date) => void state.selectDate(date)} />
              <SelectedDayAgenda selectedDate={state.selectedDate}
                holidayName={state.selectedHolidayName} holidaySupport={state.holidaySupport}
                items={state.selectedAgendaItems} onAddEvent={() => onAddEvent(state.selectedDate)} />
            </>
          )}
        </Animated.View>
      </ScrollView>
    </CalendarLoadState>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingTop: 8 },
  error: { fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 },
});

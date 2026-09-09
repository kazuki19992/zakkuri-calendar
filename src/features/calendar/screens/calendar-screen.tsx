import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const transition = useHorizontalSwipeTransition({
    onPrevious: state.showPreviousPeriod,
    onNext: state.showNextPeriod,
    reduceMotion,
    // 2日ビューの前後移動は基準日を1日分(画面の半分)だけ動かすため、
    // 見た目のスワイプ距離も画面全体ではなく半分にして更新範囲と一致させる。
    stepRatio: state.mode === 'twoDay' ? 0.5 : 1,
  });
  const periodLabel = state.mode === 'twoDay'
    ? formatTwoDayPeriod(state.twoDayDays[0].date, state.twoDayDays[1].date)
    : formatMonth(state.visibleMonth);
  const previousLabel = state.mode === 'twoDay' ? '前の1日へ' : '前月へ';
  const nextLabel = state.mode === 'twoDay' ? '次の1日へ' : '次月へ';

  const headerControls = (
    <>
      <CalendarViewSwitcher mode={state.mode} onSelectMode={(mode) => void state.selectMode(mode)} />
      <CalendarPeriodToolbar periodLabel={periodLabel} previousAccessibilityLabel={previousLabel}
        nextAccessibilityLabel={nextLabel} isLoading={state.isPeriodLoading || transition.isAnimating}
        onPrevious={() => void transition.movePrevious()} onToday={() => void state.showToday()}
        onNext={() => void transition.moveNext()} />
      {state.periodError !== null ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.calendarHoliday }]}>{state.periodError}</Text>
      ) : null}
    </>
  );

  const animatedContent = (
    <Animated.View testID="calendar.animated-content" {...transition.panHandlers}
      onLayout={(event) => transition.onLayout(event.nativeEvent.layout.width)}
      style={[
        state.mode === 'twoDay' ? styles.fill : null,
        { transform: [{ translateX: transition.translateX }] },
      ]}>
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
  );

  return (
    <CalendarLoadState status={state.status} onRetry={() => void state.retry()}>
      {/* ノッチ・ホームインジケーターなどセーフエリアは画面全体でここ1箇所にまとめて確保する。 */}
      <View testID="calendar.screen" style={[styles.root, {
        backgroundColor: theme.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }]}>
        {state.mode === 'twoDay' ? (
          // 2日表示は画面の残り高さいっぱいにタイムラインを収め、ページ全体のスクロールを行わない。
          <>
            {headerControls}
            <View style={styles.fill}>{animatedContent}</View>
          </>
        ) : (
          <ScrollView testID="calendar.scroll" style={styles.scroll} contentContainerStyle={styles.content}>
            {headerControls}
            {animatedContent}
          </ScrollView>
        )}
      </View>
    </CalendarLoadState>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingTop: 8 },
  error: { fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 },
});

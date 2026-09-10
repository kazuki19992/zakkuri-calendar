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
import { useTwoDayCarousel } from '../hooks/use-two-day-carousel';
import type { CalendarViewState } from '../hooks/use-calendar-view';
import { TWO_DAY_SWIPE_BUFFER_DAYS } from '../two-day-view-model';

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
  // 月ビューの横スワイプ・アニメーションを担う(2日ビューはuseTwoDayCarouselが担う)。
  const transition = useHorizontalSwipeTransition({
    onPrevious: state.showPreviousPeriod,
    onNext: state.showNextPeriod,
    reduceMotion,
  });
  // 2日ビューは前後に取得済みの予備列を持つため、取得完了を待たずに
  // 1列分だけジャンプなく連続スライドできる。
  const carousel = useTwoDayCarousel({
    onPrevious: state.showPreviousPeriod,
    onNext: state.showNextPeriod,
    reduceMotion,
    bufferDays: TWO_DAY_SWIPE_BUFFER_DAYS,
    leadingDate: state.twoDayStrip[0]?.date ?? state.anchorDate,
  });
  const isTwoDay = state.mode === 'twoDay';
  const periodLabel = isTwoDay
    ? formatTwoDayPeriod(state.twoDayDays[0].date, state.twoDayDays[1].date)
    : formatMonth(state.visibleMonth);
  const previousLabel = isTwoDay ? '前の1日へ' : '前月へ';
  const nextLabel = isTwoDay ? '次の1日へ' : '次月へ';
  const movePrevious = isTwoDay ? carousel.movePrevious : transition.movePrevious;
  const moveNext = isTwoDay ? carousel.moveNext : transition.moveNext;
  const isMoving = isTwoDay ? carousel.isAnimating : transition.isAnimating;

  const headerControls = (
    <>
      <CalendarViewSwitcher mode={state.mode} onSelectMode={(mode) => void state.selectMode(mode)} />
      <CalendarPeriodToolbar periodLabel={periodLabel} previousAccessibilityLabel={previousLabel}
        nextAccessibilityLabel={nextLabel} isLoading={state.isPeriodLoading || isMoving}
        onPrevious={() => void movePrevious()} onToday={() => void state.showToday()}
        onNext={() => void moveNext()} />
      {state.periodError !== null ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.calendarHoliday }]}>{state.periodError}</Text>
      ) : null}
    </>
  );

  const swipeContent = (
    <>
      <MonthGrid days={state.monthDays} onSelectDate={(date) => void state.selectDate(date)} />
      <SelectedDayAgenda selectedDate={state.selectedDate}
        holidayName={state.selectedHolidayName} holidaySupport={state.holidaySupport}
        items={state.selectedAgendaItems} onAddEvent={() => onAddEvent(state.selectedDate)} />
    </>
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
        {isTwoDay ? (
          // 2日表示は画面の残り高さいっぱいにタイムラインを収め、ページ全体のスクロールを行わない。
          // 横スワイプは予備列を持つTwoDayView自身が担うため、外側の変形・不透明度制御は不要。
          <>
            {headerControls}
            <TwoDayView
              strip={state.twoDayStrip}
              bufferDays={TWO_DAY_SWIPE_BUFFER_DAYS}
              columnWidth={carousel.columnWidth}
              translateX={carousel.translateX}
              panHandlers={carousel.panHandlers}
              onCarouselLayout={carousel.onLayout}
              onAddEvent={onAddEvent}
            />
          </>
        ) : (
          // 月表示は縦スクロールも行うため、横スワイプの受付(panHandlers)をScrollViewの
          // 祖先に置く。ScrollViewの内側に置くと、内容が縦スクロール可能になった際に
          // ScrollView自身のジェスチャーへ奪われ、横スワイプを受け付けなくなる。
          <View testID="calendar.swipe-area" style={styles.fill} {...transition.panHandlers}
            onLayout={(event) => transition.onLayout(event.nativeEvent.layout.width)}>
            <ScrollView testID="calendar.scroll" style={styles.scroll} contentContainerStyle={styles.content}>
              {headerControls}
              <Animated.View testID="calendar.animated-content"
                style={{
                  transform: [{ translateX: transition.translateX }],
                  opacity: transition.contentOpacity,
                }}>
                {swipeContent}
              </Animated.View>
            </ScrollView>
          </View>
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

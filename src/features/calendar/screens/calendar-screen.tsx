import { useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMonthStart, moveMonth } from '@/domain/calendar/month';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { createCalendarTopBarModel } from '../calendar-top-bar-model';
import { CalendarLoadState } from '../components/calendar-load-state';
import { CalendarAddEventButton } from '../components/calendar-add-event-button';
import { CalendarDatePicker } from '../components/calendar-date-picker';
import { CALENDAR_TOP_BAR_HEIGHT, CalendarTopBar } from '../components/calendar-top-bar';
import { CalendarViewMenu } from '../components/calendar-view-menu';
import { MonthGrid } from '../components/month-grid';
import { SelectedDayAgenda } from '../components/selected-day-agenda';
import { TwoDayView } from '../components/two-day-view';
import { useHorizontalSwipeTransition } from '../hooks/use-horizontal-swipe-transition';
import { useTwoDayCarousel } from '../hooks/use-two-day-carousel';
import type { CalendarViewState } from '../hooks/use-calendar-view';
import { TWO_DAY_SWIPE_BUFFER_DAYS } from '../two-day-view-model';

export function CalendarScreen({ state, onAddEvent, onEditEvent, onCreateExactAt }: Readonly<{
  state: CalendarViewState;
  onAddEvent(date: string): void;
  onEditEvent?(id: string): void;
  onCreateExactAt?(date: string, startTime: string): void;
}>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [isViewMenuVisible, setViewMenuVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
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
  const isMoving = isTwoDay ? carousel.isAnimating : transition.isAnimating;
  const displayDate = isTwoDay ? state.anchorDate : state.visibleMonth;
  const topBarModel = createCalendarTopBarModel(displayDate, state.today);

  const toggleDatePicker = () => {
    if (isDatePickerVisible) {
      setDatePickerVisible(false);
      return;
    }
    setDatePickerVisible(true);
    void state.loadDatePickerMonth(getMonthStart(displayDate));
  };

  const swipeContent = (
    <>
      <MonthGrid days={state.monthDays} onSelectDate={(date) => void state.selectDate(date)} />
      <SelectedDayAgenda selectedDate={state.selectedDate}
        holidayName={state.selectedHolidayName} holidaySupport={state.holidaySupport}
        items={state.selectedAgendaItems} onEditEvent={onEditEvent} />
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
        <CalendarTopBar model={topBarModel} isLoading={state.isPeriodLoading || isMoving}
          onOpenMenu={() => setViewMenuVisible(true)} onToggleDatePicker={toggleDatePicker}
          onToday={() => void state.showToday()} />
        {state.periodError !== null ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.calendarHoliday }]}>{state.periodError}</Text>
        ) : null}
        <CalendarViewMenu visible={isViewMenuVisible} mode={state.mode}
          onSelectMode={state.selectMode} onClose={() => setViewMenuVisible(false)} />
        <CalendarDatePicker visible={isDatePickerVisible} month={state.datePickerMonth}
          days={state.datePickerDays} isLoading={state.isDatePickerLoading}
          error={state.datePickerError ?? state.periodError}
          topOffset={insets.top + CALENDAR_TOP_BAR_HEIGHT}
          onPreviousMonth={() => void state.loadDatePickerMonth(moveMonth(state.datePickerMonth, -1))}
          onNextMonth={() => void state.loadDatePickerMonth(moveMonth(state.datePickerMonth, 1))}
          onSelectDate={state.showDate} onClose={() => setDatePickerVisible(false)} />
        {isTwoDay ? (
          // 2日表示は画面の残り高さいっぱいにタイムラインを収め、ページ全体のスクロールを行わない。
          // 横スワイプは予備列を持つTwoDayView自身が担うため、外側の変形・不透明度制御は不要。
          <>
            <TwoDayView
              strip={state.twoDayStrip}
              bufferDays={TWO_DAY_SWIPE_BUFFER_DAYS}
              columnWidth={carousel.columnWidth}
              translateX={carousel.translateX}
              panHandlers={carousel.panHandlers}
              onCarouselLayout={carousel.onLayout}
              onEditEvent={onEditEvent}
              onCreateExactAt={onCreateExactAt}
            />
            <CalendarAddEventButton onPress={() => onAddEvent(state.selectedDate)} />
          </>
        ) : (
          // 月表示は縦スクロールも行うため、横スワイプの受付(panHandlers)をScrollViewの
          // 祖先に置く。ScrollViewの内側に置くと、内容が縦スクロール可能になった際に
          // ScrollView自身のジェスチャーへ奪われ、横スワイプを受け付けなくなる。
          <View testID="calendar.swipe-area" style={styles.fill} {...transition.panHandlers}
            onLayout={(event) => transition.onLayout(event.nativeEvent.layout.width)}>
            <ScrollView testID="calendar.scroll" style={styles.scroll} contentContainerStyle={styles.content}>
              <Animated.View testID="calendar.animated-content"
                style={{
                  transform: [{ translateX: transition.translateX }],
                  opacity: transition.contentOpacity,
                }}>
              {swipeContent}
            </Animated.View>
            </ScrollView>
            <CalendarAddEventButton onPress={() => onAddEvent(state.selectedDate)} />
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

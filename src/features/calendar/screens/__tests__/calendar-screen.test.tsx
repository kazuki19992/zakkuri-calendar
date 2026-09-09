import { render, screen, userEvent, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import type { CalendarViewState } from '../../hooks/use-calendar-view';
import { useHorizontalSwipeTransition } from '../../hooks/use-horizontal-swipe-transition';
import { CalendarScreen } from '../calendar-screen';

// iPhoneのノッチ・ホームインジケーター相当の値を固定し、セーフエリア適用を検証できるようにする。
const safeAreaMetrics: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderWithSafeArea(element: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>{element}</SafeAreaProvider>,
  );
}

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => false }));
jest.mock('../../hooks/use-horizontal-swipe-transition', () => {
  const { Animated } = jest.requireActual<typeof import('react-native')>('react-native');
  // 再レンダーのたびに新しいインスタンスを作ると参照が変わってしまうため、
  // モック全体で共有し、実際のhookと同様に安定した参照を返す。
  const translateX = new Animated.Value(0);
  const contentOpacity = new Animated.Value(1);
  return {
    useHorizontalSwipeTransition: jest.fn(() => ({
      translateX,
      contentOpacity,
      panHandlers: { onStartShouldSetResponder: () => true },
      movePrevious: jest.fn(),
      moveNext: jest.fn(),
      isAnimating: false,
      onLayout: jest.fn(),
    })),
  };
});

const callbacks = {
  selectMode: jest.fn().mockResolvedValue(true),
  showPreviousPeriod: jest.fn().mockResolvedValue(true),
  showNextPeriod: jest.fn().mockResolvedValue(true),
  showToday: jest.fn().mockResolvedValue(true),
  selectDate: jest.fn().mockResolvedValue(true),
  retry: jest.fn().mockResolvedValue(true),
};

function createState(overrides: Partial<CalendarViewState> = {}): CalendarViewState {
  return {
    status: 'ready', mode: 'twoDay', today: '2026-09-08', anchorDate: '2026-09-08',
    visibleMonth: '2026-09-01', selectedDate: '2026-09-08',
    twoDayDays: [
      { date: '2026-09-08', dateLabel: '9月8日', weekdayLabel: '火', isToday: true,
        holidayName: null, holidaySupport: 'available', allDayItems: [], timelineItems: [],
        accessibilityLabel: '2026年9月8日、火曜日、今日、予定なし' },
      { date: '2026-09-09', dateLabel: '9月9日', weekdayLabel: '水', isToday: false,
        holidayName: null, holidaySupport: 'available', allDayItems: [], timelineItems: [],
        accessibilityLabel: '2026年9月9日、水曜日、予定なし' },
    ],
    monthDays: [], selectedAgendaItems: [], selectedHolidayName: null,
    holidaySupport: 'available', isPeriodLoading: false, periodError: null,
    ...callbacks, ...overrides,
  };
}

describe('カレンダー画面', () => {
  beforeEach(() => jest.clearAllMocks());

  it('初期2日表示を共通のスワイプ領域へ表示し、各日から予定を追加する', async () => {
    const onAddEvent = jest.fn();
    const user = userEvent.setup();
    const state = createState();
    await renderWithSafeArea(<CalendarScreen state={state} onAddEvent={onAddEvent} />);

    expect(screen.getByRole('tab', { name: '2日表示' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText('2026年9月8日〜9日')).toBeOnTheScreen();
    expect(screen.getByTestId('calendar.animated-content').props.onStartShouldSetResponder).toBeDefined();
    expect(useHorizontalSwipeTransition).toHaveBeenCalledWith({
      onPrevious: state.showPreviousPeriod,
      onNext: state.showNextPeriod,
      reduceMotion: false,
      stepRatio: 0.5,
    });
    await user.press(screen.getByRole('button', { name: '9月9日に予定を追加' }));
    expect(onAddEvent).toHaveBeenCalledWith('2026-09-09');
  });

  it('月表示では画面全体分の距離でスワイプ遷移させる', async () => {
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month' })} onAddEvent={jest.fn()} />);

    expect(useHorizontalSwipeTransition).toHaveBeenCalledWith(expect.objectContaining({ stepRatio: 1 }));
  });

  it('表示切替と期間ツールバーの操作を状態へ渡す', async () => {
    const state = createState();
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={state} onAddEvent={jest.fn()} />);

    await user.press(screen.getByRole('tab', { name: '月表示' }));
    await user.press(screen.getByRole('button', { name: '前の1日へ' }));
    await user.press(screen.getByRole('button', { name: '今日' }));
    await user.press(screen.getByRole('button', { name: '次の1日へ' }));
    expect(callbacks.selectMode).toHaveBeenCalledWith('month');
    const swipe = jest.mocked(useHorizontalSwipeTransition).mock.results[0]?.value;
    expect(swipe.movePrevious).toHaveBeenCalledTimes(1);
    expect(callbacks.showToday).toHaveBeenCalledTimes(1);
    expect(swipe.moveNext).toHaveBeenCalledTimes(1);
  });

  it('2日表示で画面全体にセーフエリア分の余白を確保する', async () => {
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    expect(StyleSheet.flatten(screen.getByTestId('calendar.screen').props.style)).toMatchObject({
      paddingTop: safeAreaMetrics.insets.top,
      paddingBottom: safeAreaMetrics.insets.bottom,
      paddingLeft: safeAreaMetrics.insets.left,
      paddingRight: safeAreaMetrics.insets.right,
    });
  });

  it('月表示でも画面全体にセーフエリア分の余白を確保する', async () => {
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month' })} onAddEvent={jest.fn()} />);

    expect(StyleSheet.flatten(screen.getByTestId('calendar.screen').props.style)).toMatchObject({
      paddingTop: safeAreaMetrics.insets.top,
      paddingBottom: safeAreaMetrics.insets.bottom,
      paddingLeft: safeAreaMetrics.insets.left,
      paddingRight: safeAreaMetrics.insets.right,
    });
  });

  it('2日表示ではスクロール領域を持たず残り高さいっぱいにタイムラインを表示する', async () => {
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    expect(screen.queryByTestId('calendar.scroll')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('calendar.animated-content').props.style))
      .toMatchObject({ flex: 1 });
  });

  it('月表示では従来通りページ全体をスクロール領域にする', async () => {
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month' })} onAddEvent={jest.fn()} />);

    expect(screen.getByTestId('calendar.scroll')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByTestId('calendar.animated-content').props.style).flex)
      .toBeUndefined();
  });

  it('月表示では横スワイプの受付領域をスクロール領域の祖先にし、縦スクロールと競合しない', async () => {
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month' })} onAddEvent={jest.fn()} />);

    const swipeArea = screen.getByTestId('calendar.swipe-area');
    expect(swipeArea.props.onStartShouldSetResponder).toBeDefined();
    expect(within(swipeArea).getByTestId('calendar.scroll')).toBeOnTheScreen();
  });

  it.each([['twoDay'], ['month']] as const)('%s表示でも入場時の瞬間移動を隠す不透明度をスワイプ内容へ適用する', async (mode) => {
    await renderWithSafeArea(<CalendarScreen state={createState({ mode })} onAddEvent={jest.fn()} />);

    expect(StyleSheet.flatten(screen.getByTestId('calendar.animated-content').props.style).opacity)
      .toBeDefined();
  });

  it('月表示では独自グリッドと選択日の予定一覧を表示する', async () => {
    const onAddEvent = jest.fn();
    const user = userEvent.setup();
    const monthDay = { date: '2026-09-21', dayNumber: 21, weekday: 1, isCurrentMonth: true,
      isToday: false, isSelected: true, hasEvents: false, holidaySupport: 'available' as const,
      holidayName: '敬老の日', accessibilityLabel: '2026年9月21日、敬老の日、選択中' };
    const monthDays = Array.from({ length: 42 }, (_, index) => ({
      ...monthDay,
      date: index === 21 ? monthDay.date : `grid-date-${index}`,
      dayNumber: index + 1,
      accessibilityLabel: index === 21 ? monthDay.accessibilityLabel : `グリッド日付${index + 1}`,
    }));
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month', selectedDate: '2026-09-21', monthDays,
      selectedHolidayName: '敬老の日' })} onAddEvent={onAddEvent} />);

    expect(screen.getByText('2026年9月')).toBeOnTheScreen();
    expect(screen.getAllByTestId('month-calendar.week')).toHaveLength(6);
    await user.press(screen.getByRole('button', { name: '予定を追加' }));
    expect(onAddEvent).toHaveBeenCalledWith('2026-09-21');
  });

  it('Notion風のlightとdarkの具体色を提供する', () => {
    expect(Colors.light).toMatchObject({ text: '#37352F', background: '#FFFFFF', calendarAccent: '#8B6F5A' });
    expect(Colors.dark).toMatchObject({ text: '#EDECE9', background: '#191919', calendarAccent: '#C6A58A' });
  });
});

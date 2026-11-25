import { fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { getContrastRatio } from '@/constants/event-colors';
import { Colors } from '@/constants/theme';
import type { CalendarViewState } from '../../hooks/use-calendar-view';
import { useTwoDayCarousel } from '../../hooks/use-two-day-carousel';
import { CalendarScreen } from '../calendar-screen';
import { offsetCalendarDate } from '@/domain/calendar/month';

// iPhoneのノッチ・ホームインジケーター相当の値を固定し、セーフエリア適用を検証できるようにする。
const safeAreaMetrics: Metrics = {
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderWithSafeArea(element: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>{element}</SafeAreaProvider>,
    { wrapper: GestureHandlerRootView },
  );
}

jest.mock('@/global.css', () => ({}));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    useSharedValue: (value: unknown) => ({ value }),
    useEvent: (callback: unknown) => callback,
    FadeOut: { duration: (duration: number) => ({ duration }) },
    Keyframe: class {
      duration(duration: number) { return { duration }; }
    },
  };
});
jest.mock('expo-router', () => {
  function MockLink({ children }: { children: ReactNode }) { return <>{children}</>; }
  function MockLinkTrigger({ children }: { children: ReactNode }) { return <>{children}</>; }
  function MockLinkPreview() { return null; }
  const Link = Object.assign(MockLink, { Trigger: MockLinkTrigger, Preview: MockLinkPreview });
  return { Link };
});
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => true }));
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
jest.mock('../../hooks/use-two-day-carousel', () => {
  const { Animated } = jest.requireActual<typeof import('react-native')>('react-native');
  const translateX = new Animated.Value(-195);
  return {
    useTwoDayCarousel: jest.fn(() => ({
      translateX,
      columnWidth: 195,
      panHandlers: { onStartShouldSetResponder: () => true },
      movePrevious: jest.fn(),
      moveNext: jest.fn(),
      isAnimating: false,
      onLayout: jest.fn(),
    })),
  };
});

const callbacks = {
  showDay: jest.fn().mockResolvedValue(true),
  selectMode: jest.fn().mockResolvedValue(true),
  showPreviousPeriod: jest.fn().mockResolvedValue(true),
  showNextPeriod: jest.fn().mockResolvedValue(true),
  showToday: jest.fn().mockResolvedValue(true),
  showDate: jest.fn().mockResolvedValue(true),
  selectDate: jest.fn().mockResolvedValue(true),
  setCalendarVisible: jest.fn().mockResolvedValue(true),
  retry: jest.fn().mockResolvedValue(true),
};

const twoDayDays: CalendarViewState['twoDayDays'] = [
  { date: '2026-09-08', dateLabel: '9月8日', weekdayLabel: '火', isToday: true,
    holidayName: null, holidaySupport: 'available', allDayItems: [], timelineItems: [],
    accessibilityLabel: '2026年9月8日、火曜日、今日、予定なし' },
  { date: '2026-09-09', dateLabel: '9月9日', weekdayLabel: '水', isToday: false,
    holidayName: null, holidaySupport: 'available', allDayItems: [], timelineItems: [],
    accessibilityLabel: '2026年9月9日、水曜日、予定なし' },
];
const twoDayStrip: CalendarViewState['twoDayStrip'] = [
  { date: '2026-09-07', dateLabel: '9月7日', weekdayLabel: '月', isToday: false,
    holidayName: null, holidaySupport: 'available', allDayItems: [], timelineItems: [],
    accessibilityLabel: '2026年9月7日、月曜日、予定なし' },
  ...twoDayDays,
  { date: '2026-09-10', dateLabel: '9月10日', weekdayLabel: '木', isToday: false,
    holidayName: null, holidaySupport: 'available', allDayItems: [], timelineItems: [],
    accessibilityLabel: '2026年9月10日、木曜日、予定なし' },
];

function createState(overrides: Partial<CalendarViewState> = {}): CalendarViewState {
  return {
    status: 'ready', mode: 'twoDay', today: '2026-09-08', anchorDate: '2026-09-08',
    visibleMonth: '2026-09-01', selectedDate: '2026-09-08',
    twoDayDays, twoDayStrip, dayStrip: twoDayStrip.slice(0, 3), weekStrip: [],
    monthDays: [], monthWeeks: [],
    selectedAgendaItems: [], selectedHolidayName: null,
    holidaySupport: 'available', isPeriodLoading: false, navigationRevision: 0, isViewModeUpdating: false, periodError: null,
    viewModePersistenceError: null,
    calendarName: 'マイカレンダー', calendarColorId: 'blue', isCalendarVisible: true,
    isCalendarVisibilityUpdating: false, calendarVisibilityError: null,
    ...callbacks, ...overrides,
  };
}

describe('カレンダー画面', () => {
  beforeEach(() => jest.clearAllMocks());
  it('表示設定の再描画ではカルーセルのナビゲーショントークンを変えない', async () => {
    const state = createState();
    const view = await renderWithSafeArea(<CalendarScreen state={state} onAddEvent={jest.fn()} />);
    const originalKey = jest.mocked(useTwoDayCarousel).mock.calls.at(-1)?.[0].navigationKey;
    await view.rerender(<SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <CalendarScreen state={{ ...state, isCalendarVisibilityUpdating: true }} onAddEvent={jest.fn()} />
    </SafeAreaProvider>);
    expect(jest.mocked(useTwoDayCarousel).mock.calls.at(-1)?.[0].navigationKey).toBe(originalKey);
  });
  it('週モードの範囲と週移動を表示し日付から履歴なしで1日へ切り替える', async () => {
    const weekStrip = Array.from({ length: 21 }, (_, index) => ({ ...twoDayDays[0],
      date: offsetCalendarDate('2026-09-07', index - 7), isToday: index === 8 }));
    const state = createState({ mode: 'week', weekStrip });
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={state} onAddEvent={jest.fn()} />);
    expect(screen.getByText('9月7日〜9月13日')).toBeOnTheScreen();
    expect(useTwoDayCarousel).toHaveBeenLastCalledWith(expect.objectContaining({ visibleDayCount: 7, stepDays: 7, bufferDays: 7 }));
    await user.press(within(screen.getByTestId('week-day-header.2026-09-08')).getByRole('button'));
    expect(state.showDay).toHaveBeenCalledWith('2026-09-08');
    await user.press(screen.getByRole('button', { name: '前週へ移動' }));
    expect(jest.mocked(useTwoDayCarousel).mock.results.at(-1)?.value.movePrevious).toHaveBeenCalledTimes(1);
  });

  it('1日モードは一列時間軸と前後日操作を表示する', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'day' })} onAddEvent={jest.fn()} />);
    expect(screen.getByTestId('single-day-calendar')).toBeOnTheScreen();
    expect(useTwoDayCarousel).toHaveBeenLastCalledWith(expect.objectContaining({ visibleDayCount: 1 }));
    await user.press(screen.getByRole('button', { name: '翌日へ移動' }));
    expect(jest.mocked(useTwoDayCarousel).mock.results.at(-1)?.value.moveNext).toHaveBeenCalledTimes(1);
  });

  it('表示を維持した期間エラーでも再読み込みできる', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState({ periodError: '表示期間を読み込めませんでした' })} onAddEvent={jest.fn()} />);
    expect(screen.getByTestId('two-day-calendar')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'カレンダーを再読み込み' }));
    expect(callbacks.retry).toHaveBeenCalledTimes(1);
  });

  it('初期2日表示へトップバーと常設追加ボタンを表示する', async () => {
    const onAddEvent = jest.fn();
    const user = userEvent.setup();
    const state = createState();
    await renderWithSafeArea(<CalendarScreen state={state} onAddEvent={onAddEvent} />);

    expect(screen.getByRole('button', { name: '表示メニューを開く' })).toBeOnTheScreen();
    expect(screen.getByText('9月')).toBeOnTheScreen();
    expect(screen.queryByText('2026年9月8日〜9日')).toBeNull();
    expect(screen.getByTestId('two-day-calendar').props.onStartShouldSetResponder).toBeDefined();
    expect(useTwoDayCarousel).toHaveBeenCalledWith({
      onPrevious: state.showPreviousPeriod,
      onNext: state.showNextPeriod,
      reduceMotion: true,
      bufferDays: 1,
      navigationKey: state.navigationRevision,
      leadingDate: '2026-09-07',
    });
    await user.press(screen.getByRole('button', { name: '予定を追加' }));
    expect(onAddEvent).toHaveBeenCalledWith('2026-09-08');
  });

  it('メイン画面から表示形式と期間を切り替え、下部で予定を追加できる', async () => {
    const user = userEvent.setup();
    const state = createState();
    await renderWithSafeArea(<CalendarScreen state={state} onAddEvent={jest.fn()} />);

    expect(screen.getByRole('tab', { name: '2日表示' })).toBeSelected();
    await user.press(screen.getByRole('tab', { name: '週表示' }));
    expect(state.selectMode).toHaveBeenCalledWith('week');
    await user.press(screen.getByRole('button', { name: '翌日へ移動' }));
    expect(jest.mocked(useTwoDayCarousel).mock.results.at(-1)?.value.moveNext).toHaveBeenCalledTimes(1);

    const toolbar = within(screen.getByTestId('calendar.bottom-bar'));
    expect(toolbar.getByRole('button', { name: '6時間' })).toBeSelected();
    expect(toolbar.getByRole('button', { name: '24時間' })).toBeEnabled();
    expect(toolbar.getByText('予定を追加')).toBeOnTheScreen();
  });

  it('今日ボタンは現在日への移動を呼ぶ', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: '今日へ移動' }));
    expect(callbacks.showToday).toHaveBeenCalledTimes(1);
  });

  it('上部セグメントから月表示へ切り替える', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    await user.press(screen.getByRole('tab', { name: '月表示' }));
    expect(callbacks.selectMode).toHaveBeenCalledWith('month');
  });

  it('サイドメニューからマイカレンダーの表示を切り替える', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: '表示メニューを開く' }));
    await fireEvent(screen.getByTestId('calendar-side-menu.visibility-switch'), 'isOnChange', {
      nativeEvent: { isOn: false },
    });

    await waitFor(() => expect(callbacks.setCalendarVisible).toHaveBeenCalledWith(false));
  });

  it('サイドメニューに設定画面への導線を表示する', async () => {
    const user = userEvent.setup();
    const onOpenSettings = jest.fn();
    await renderWithSafeArea(
      <CalendarScreen state={createState()} onAddEvent={jest.fn()} onOpenSettings={onOpenSettings} />,
    );

    await user.press(screen.getByRole('button', { name: '表示メニューを開く' }));
    expect(screen.getByRole('button', { name: '設定を開く' })).toBeOnTheScreen();
    const panel = screen.getByTestId('calendar-side-menu.panel');
    expect(panel.props.edges).toMatchObject({
      top: 'additive', left: 'additive', bottom: 'additive', right: 'additive',
    });
  });

  it.each(['day', 'twoDay', 'week'] as const)('%sの月名を押すと表示中の日付の月へ切り替える', async (mode) => {
    const user = userEvent.setup();
    const state = createState({ mode, anchorDate: '2026-09-08' });
    await renderWithSafeArea(<CalendarScreen state={state} onAddEvent={jest.fn()} />);
    await user.press(screen.getByRole('button', { name: '2026年9月、月表示に切り替え' }));
    expect(state.selectMode).toHaveBeenCalledWith('month', '2026-09-08');
  });

  it('月名から年月ピッカーを開き、別の年の月へ移動する', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month' })} onAddEvent={jest.fn()} />);
    await user.press(screen.getByRole('button', { name: '2026年9月、年月を選択' }));
    await user.press(screen.getByRole('button', { name: '次の年' }));
    await user.press(screen.getByRole('button', { name: '2027年7月' }));
    expect(callbacks.showDate).toHaveBeenCalledWith('2027-07-01');
  });

  it('年月ピッカーを閉じるボタンから閉じられる', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month' })} onAddEvent={jest.fn()} />);
    await user.press(screen.getByRole('button', { name: '2026年9月、年月を選択' }));
    expect(screen.getByTestId('calendar-date-picker.panel')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: '年月選択を閉じる' }));
    expect(screen.queryByTestId('calendar-date-picker.panel')).toBeNull();
  });

  it('24時間表示を月表示を経由した1日表示へ引き継ぐ', async () => {
    const onAddEvent = jest.fn();
    const makeScreen = (mode: CalendarViewState['mode']) => (
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <CalendarScreen state={createState({ mode })} onAddEvent={onAddEvent} />
      </SafeAreaProvider>
    );
    const view = await render(makeScreen('twoDay'), { wrapper: GestureHandlerRootView });
    await fireEvent.press(view.getByRole('button', { name: '24時間' }));
    await view.rerender(makeScreen('month'));
    await view.rerender(makeScreen('day'));
    expect(view.getByRole('button', { name: '24時間' })).toBeSelected();
  });

  it('日付ピッカーはトップバーと同じ安全領域の下から表示する', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month' })} onAddEvent={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: '2026年9月、年月を選択' }));
    const overlay = screen.getByTestId('calendar-date-picker.backdrop');
    expect(StyleSheet.flatten(overlay.props.style)).toMatchObject({ paddingTop: 52 });
    expect(overlay.props.edges).toMatchObject({
      top: 'additive', left: 'additive', bottom: 'additive', right: 'additive',
    });
  });

  it('日付選択の表示取得に失敗した理由をピッカー内に表示する', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(
      <CalendarScreen state={createState({ mode: 'month', periodError: '表示期間を読み込めませんでした' })}
        onAddEvent={jest.fn()} />,
    );

    await user.press(screen.getByRole('button', { name: '2026年9月、年月を選択' }));
    expect(within(screen.getByTestId('calendar-date-picker.panel')).getByRole('alert'))
      .toHaveTextContent('表示期間を読み込めませんでした');
  });

  it('表示設定の保存失敗をtop bar直下のalertとして表示する', async () => {
    await renderWithSafeArea(
      <CalendarScreen
        state={createState({ viewModePersistenceError: '表示設定を保存できませんでした' })}
        onAddEvent={jest.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('表示設定を保存できませんでした');
  });

  it('期間取得と表示設定保存のerrorを独立して表示する', async () => {
    await renderWithSafeArea(
      <CalendarScreen
        state={createState({
          periodError: '表示期間を読み込めませんでした',
          viewModePersistenceError: '表示設定を保存できませんでした',
        })}
        onAddEvent={jest.fn()}
      />,
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts.map((item) => item.props.children)).toEqual([
      '表示期間を読み込めませんでした',
      '表示設定を保存できませんでした',
    ]);
    expect(alerts.map((item) => item.props.accessibilityLiveRegion)).toEqual([
      'assertive',
      'assertive',
    ]);
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

  it('2日表示ではスクロール領域を持たず、予備列付きのタイムラインを直接表示する', async () => {
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    expect(screen.queryByTestId('calendar.scroll')).toBeNull();
    expect(screen.getByTestId('two-day-calendar')).toBeOnTheScreen();
  });

  it('月表示ではスクロール領域を持たず、残り高さいっぱいにグリッドを表示する', async () => {
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month' })} onAddEvent={jest.fn()} />);

    expect(screen.queryByTestId('calendar.scroll')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('calendar.animated-content').props.style).flex)
      .toBe(1);
  });

  it('月表示では横スワイプの受付領域で全画面グリッドを操作する', async () => {
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month' })} onAddEvent={jest.fn()} />);

    const swipeArea = screen.getByTestId('calendar.swipe-area');
    expect(swipeArea.props.onStartShouldSetResponder).toBeDefined();
    expect(within(swipeArea).getByTestId('month-calendar')).toBeOnTheScreen();
  });

  it('月表示では入場時の瞬間移動を隠す不透明度をスワイプ内容へ適用する', async () => {
    await renderWithSafeArea(<CalendarScreen state={createState({ mode: 'month' })} onAddEvent={jest.fn()} />);

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

    expect(screen.getByText('9月')).toBeOnTheScreen();
    expect(screen.getAllByTestId('month-calendar.week')).toHaveLength(6);
    await user.press(screen.getByRole('button', { name: '予定を追加' }));
    expect(onAddEvent).toHaveBeenCalledWith('2026-09-21');
  });

  it('カレンダー用lightとdarkのsemantic colorを提供する', () => {
    for (const theme of Object.values(Colors)) {
      expect(getContrastRatio(theme.calendarAccent, theme.background)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(theme.text, theme.backgroundElement)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(theme.text, theme.backgroundSelected)).toBeGreaterThanOrEqual(4.5);
    }
    expect(Colors.light.calendarEventText).toBe(Colors.light.background);
    expect(Colors.dark.calendarEventText).toBe(Colors.dark.background);
  });
});

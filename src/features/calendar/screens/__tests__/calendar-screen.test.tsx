import { act, fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import type { CalendarViewState } from '../../hooks/use-calendar-view';
import { useTwoDayCarousel } from '../../hooks/use-two-day-carousel';
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
  selectMode: jest.fn().mockResolvedValue(true),
  showPreviousPeriod: jest.fn().mockResolvedValue(true),
  showNextPeriod: jest.fn().mockResolvedValue(true),
  showToday: jest.fn().mockResolvedValue(true),
  showDate: jest.fn().mockResolvedValue(true),
  loadDatePickerMonth: jest.fn().mockResolvedValue(true),
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
    twoDayDays, twoDayStrip,
    monthDays: [], datePickerMonth: '2026-09-01', datePickerDays: [],
    selectedAgendaItems: [], selectedHolidayName: null,
    holidaySupport: 'available', isPeriodLoading: false, periodError: null,
    isDatePickerLoading: false, datePickerError: null,
    calendarName: 'マイカレンダー', calendarColorId: 'blue', isCalendarVisible: true,
    isCalendarVisibilityUpdating: false, calendarVisibilityError: null,
    ...callbacks, ...overrides,
  };
}

describe('カレンダー画面', () => {
  beforeEach(() => jest.clearAllMocks());

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
      reduceMotion: false,
      bufferDays: 1,
      leadingDate: '2026-09-07',
    });
    await user.press(screen.getByRole('button', { name: '予定を追加' }));
    expect(onAddEvent).toHaveBeenCalledWith('2026-09-08');
  });

  it('今日ボタンは現在日への移動を呼ぶ', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: '今日へ移動' }));
    expect(callbacks.showToday).toHaveBeenCalledTimes(1);
  });

  it('表示メニューから月表示へ切り替える', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: '表示メニューを開く' }));
    await user.press(screen.getByRole('menuitem', { name: '月表示' }));
    expect(callbacks.selectMode).toHaveBeenCalledWith('month');
  });

  it('サイドメニューからマイカレンダーの表示を切り替える', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: '表示メニューを開く' }));
    await act(async () => {
      fireEvent(screen.getByRole('switch', { name: 'マイカレンダーを表示' }), 'valueChange', false);
      await Promise.resolve();
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
  });

  it('月名から日付ピッカーを開いて任意日へ移動する', async () => {
    const user = userEvent.setup();
    const pickerDays = Array.from({ length: 42 }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, '0')}`, dayNumber: index + 1,
      weekday: index % 7, isCurrentMonth: true, isToday: index === 7, isSelected: false,
      hasEvents: false, holidaySupport: 'available' as const, holidayName: null,
      accessibilityLabel: `ピッカー日付${index + 1}`,
    }));
    await renderWithSafeArea(<CalendarScreen state={createState({ datePickerDays: pickerDays })} onAddEvent={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: '2026年9月、日付を選択' }));
    expect(callbacks.loadDatePickerMonth).toHaveBeenCalledWith('2026-09-01');
    await user.press(screen.getByLabelText('ピッカー日付24'));
    expect(callbacks.showDate).toHaveBeenCalledWith('2026-09-24');
  });

  it('月名をもう一度押すと日付ピッカーを閉じ、再読込しない', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    const monthButton = screen.getByRole('button', { name: '2026年9月、日付を選択' });
    await user.press(monthButton);
    expect(screen.getByTestId('calendar-date-picker.panel')).toBeOnTheScreen();
    expect(callbacks.loadDatePickerMonth).toHaveBeenCalledTimes(1);

    await user.press(monthButton);
    expect(screen.queryByTestId('calendar-date-picker.panel')).toBeNull();
    expect(callbacks.loadDatePickerMonth).toHaveBeenCalledTimes(1);
  });

  it('日付ピッカーはトップバーと同じ安全領域の下から表示する', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(<CalendarScreen state={createState()} onAddEvent={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: '2026年9月、日付を選択' }));
    expect(StyleSheet.flatten(screen.getByTestId('calendar-date-picker.backdrop').props.style))
      .toMatchObject({ paddingTop: safeAreaMetrics.insets.top + 52 });
  });

  it('日付選択の表示取得に失敗した理由をピッカー内に表示する', async () => {
    const user = userEvent.setup();
    await renderWithSafeArea(
      <CalendarScreen state={createState({ periodError: '表示期間を読み込めませんでした' })}
        onAddEvent={jest.fn()} />,
    );

    await user.press(screen.getByRole('button', { name: '2026年9月、日付を選択' }));
    expect(within(screen.getByTestId('calendar-date-picker.panel')).getByRole('alert'))
      .toHaveTextContent('表示期間を読み込めませんでした');
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
    expect(Colors.light).toMatchObject({
      text: '#202124', background: '#FFFFFF', textSecondary: '#5F6368',
      calendarAccent: '#1A73E8', calendarBorder: '#DADCE0', calendarEvent: '#185ABC',
    });
    expect(Colors.dark).toMatchObject({
      text: '#E8EAED', background: '#202124', calendarEvent: '#AECBFA',
    });
    expect(Colors.light.calendarEventText).toBe(Colors.light.background);
    expect(Colors.dark.calendarEventText).toBe(Colors.dark.background);
  });
});

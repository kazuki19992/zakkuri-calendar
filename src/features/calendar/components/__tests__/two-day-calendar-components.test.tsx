import { act, fireEvent, render as renderComponent, userEvent, waitFor, within } from '@testing-library/react-native';
import { useImperativeHandle, type ComponentProps, type ComponentRef, type ReactElement } from 'react';
import { Animated, PanResponder, PixelRatio, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { Colors, Radii } from '@/constants/theme';
import {
  HOUR_HEIGHT,
  MIN_EVENT_HEIGHT,
  TIMELINE_HEIGHT,
  computeHourLineTop,
  computeTimelineScale,
} from '../../timeline-layout';
import type { TwoDayViewModel } from '../../two-day-view-model';
import type { SavedCalendarEvent } from '../../calendar-refresh-context';
import { CalendarAddEventButton } from '../calendar-add-event-button';
import { TwoDayView } from '../two-day-view';
import { TimelineAxis } from '../timeline-axis';

jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: jest.fn(() => true) }));
jest.mock('@/global.css', () => ({}));
jest.mock('expo-linear-gradient', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { LinearGradient: (props: React.ComponentProps<typeof View>) => React.createElement(View, props) };
});

const defaultPanHandlers = PanResponder.create({}).panHandlers;

function axisPadding(view: Awaited<ReturnType<typeof render>>) {
  return StyleSheet.flatten(view.getByTestId('two-day-calendar.timeline-scroll').props.contentContainerStyle).paddingTop;
}

function render(element: ReactElement) {
  return renderComponent(element, { wrapper: GestureHandlerRootView });
}

const timelineItem = {
  id: 'event-1', eventId: 'event-1', colorId: 'red', title: '歯医者', temporalLabel: '14:30・30分',
  accessibilityLabel: '歯医者、14:30・30分', startMinute: 870, endMinute: 900,
  top: 812, height: 36, overlapIndex: 0, overlapCount: 1,
  opacityStops: [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }],
  isInstant: false, continuesFromPreviousDay: false, continuesToNextDay: false,
} as const;

const allDayItem = {
  kind: 'event',
  id: 'all-day-event',
  eventId: 'all-day-event',
  colorId: 'blue',
  isInteractive: true,
  title: '休暇',
  temporalLabel: '終日',
  accessibilityLabel: '休暇、終日',
} as const;

const holidayItem = {
  kind: 'holiday',
  id: 'holiday:2026-09-08',
  eventId: null,
  colorId: 'holiday',
  isInteractive: false,
  title: 'テスト記念日',
  temporalLabel: '祝日',
  accessibilityLabel: 'テスト記念日、祝日',
} as const;

function emptyDay(overrides: Partial<TwoDayViewModel> & Pick<TwoDayViewModel, 'date' | 'dateLabel' | 'weekdayLabel' | 'accessibilityLabel'>): TwoDayViewModel {
  return {
    isToday: false, holidayName: null, holidaySupport: 'available',
    allDayItems: [], timelineItems: [],
    ...overrides,
  };
}

const prevBuffer = emptyDay({
  date: '2026-09-07', dateLabel: '9月7日', weekdayLabel: '月',
  accessibilityLabel: '2026年9月7日、月曜日、予定なし',
});
const day1: TwoDayViewModel = {
  date: '2026-09-08', dateLabel: '9月8日', weekdayLabel: '火', isToday: true,
  holidayName: null, holidaySupport: 'available',
  allDayItems: [], timelineItems: [timelineItem],
  accessibilityLabel: '2026年9月8日、火曜日、今日、予定1件',
};
const day2: TwoDayViewModel = {
  date: '2026-09-09', dateLabel: '9月9日', weekdayLabel: '水', isToday: false,
  holidayName: null, holidaySupport: 'unsupported', allDayItems: [], timelineItems: [],
  accessibilityLabel: '2026年9月9日、水曜日、祝日情報未対応、予定なし',
};
const nextBuffer = emptyDay({
  date: '2026-09-10', dateLabel: '9月10日', weekdayLabel: '木',
  accessibilityLabel: '2026年9月10日、木曜日、予定なし',
});
const strip: readonly TwoDayViewModel[] = [prevBuffer, day1, day2, nextBuffer];

const BUFFER_DAYS = 1;
const COLUMN_WIDTH = 195;

async function renderTwoDayView(overrides: Partial<{
  strip: readonly TwoDayViewModel[];
  bufferDays: number;
  columnWidth: number;
  now: () => Date;
  focused: boolean;
  visibleDayCount: 1 | 2;
  onEditEvent(id: string): void;
  onCreateExactAt(date: string, startTime: string): void;
}> = {}) {
  const view = await render(
    <TwoDayView
      visibleDayCount={overrides.visibleDayCount}
      strip={overrides.strip ?? strip}
      bufferDays={overrides.bufferDays ?? BUFFER_DAYS}
      columnWidth={overrides.columnWidth ?? COLUMN_WIDTH}
      translateX={new Animated.Value(-(overrides.bufferDays ?? BUFFER_DAYS) * (overrides.columnWidth ?? COLUMN_WIDTH))}
      panHandlers={defaultPanHandlers}
      onCarouselLayout={jest.fn()}
      onEditEvent={overrides.onEditEvent}
      onCreateExactAt={overrides.onCreateExactAt}
      now={overrides.now}
    />,
  );
  if (!overrides.focused) await fireEvent.press(view.getByRole('button', { name: '24時間' }));
  return view;
}

describe('2日カレンダー表示コンポーネント', () => {
  it('別の列へ指を置いた複数指操作でも過去のタップを引き継がない', async () => {
    const onCreateExactAt = jest.fn();
    const view = await renderTwoDayView({ onCreateExactAt });
    const root = view.getByTestId('two-day-calendar');
    const [first, second] = view.getAllByTestId('two-day-calendar.timeline-column').slice(1, 3);
    await fireEvent(first, 'touchEnd', { nativeEvent: { locationY: 100, touches: [] } });
    await act(() => root.props.onTouchStart({ nativeEvent: { touches: [{}, {}] } }));
    await fireEvent(second, 'touchEnd', { nativeEvent: { locationY: 100, touches: [] } });
    await act(() => root.props.onTouchStart({ nativeEvent: { touches: [{}] } }));
    await fireEvent(first, 'touchEnd', { nativeEvent: { locationY: 100, touches: [] } });
    expect(onCreateExactAt).not.toHaveBeenCalled();
  });
  it.each([1, 2, 7] as const)('%i日表示で日付を移動しても6時間の中心を現在時刻に保つ', async (visibleDayCount) => {
    const reactNative = jest.requireActual<typeof import('react-native')>('react-native');
    const { ScrollView } = reactNative;
    const scrollTo = jest.fn();
    function ScrollProbe({ ref, ...props }: ComponentProps<typeof ScrollView>) {
      useImperativeHandle(ref, () => ({ scrollTo } as unknown as ComponentRef<typeof ScrollView>));
      return <ScrollView {...props} />;
    }
    const scrollPort = jest.spyOn(reactNative as { readonly ScrollView: unknown }, 'ScrollView', 'get')
      .mockReturnValue(ScrollProbe);
    const translateX = new Animated.Value(0);
    const now = () => new Date(2026, 8, 8, 19, 0);
    const makeView = (includesToday: boolean) => {
      const firstDay = includesToday ? 8 : 15;
      const visible = Array.from({ length: visibleDayCount }, (_, index) => ({
        ...day1,
        date: `2026-09-${String(firstDay + index).padStart(2, '0')}`,
        isToday: includesToday && index === 0,
        timelineItems: includesToday ? [] : [timelineItem],
      }));
      return <TwoDayView visibleDayCount={visibleDayCount} strip={visible} bufferDays={0}
        columnWidth={48} translateX={translateX} panHandlers={defaultPanHandlers} now={now}
        onCarouselLayout={jest.fn()} />;
    };
    try {
      const view = await render(makeView(true));
      expect(view.getByRole('button', { name: '6時間' })).toBeSelected();
      expect(view.getByTestId('two-day-calendar.timeline-scroll').props.contentOffset.y).toBe(16 * 4 * HOUR_HEIGHT);
      scrollTo.mockClear();
      await view.rerender(makeView(false));
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 16 * 4 * HOUR_HEIGHT, animated: false });
    } finally {
      scrollPort.mockRestore();
    }
  });

  it('表示中の日に予定を保存すると、その時刻へスクロールして対象だけを強調する', async () => {
    const reactNative = jest.requireActual<typeof import('react-native')>('react-native');
    const { ScrollView } = reactNative;
    const scrollTo = jest.fn();
    function ScrollProbe({ ref, ...props }: ComponentProps<typeof ScrollView>) {
      useImperativeHandle(ref, () => ({ scrollTo } as unknown as ComponentRef<typeof ScrollView>));
      return <ScrollView {...props} />;
    }
    const scrollPort = jest.spyOn(reactNative as { readonly ScrollView: unknown }, 'ScrollView', 'get')
      .mockReturnValue(ScrollProbe);
    const earlier = { ...timelineItem, id: 'earlier', eventId: 'earlier', startMinute: 9 * 60, top: 9 * HOUR_HEIGHT };
    const day = { ...day1, isToday: false, timelineItems: [earlier, timelineItem] };
    const translateX = new Animated.Value(-390);
    const now = () => new Date(2026, 8, 9, 1);
    const makeView = (savedEvent: SavedCalendarEvent | null) => (
      <TwoDayView visibleDayCount={1} strip={[prevBuffer, day, nextBuffer]}
        bufferDays={1} columnWidth={390} translateX={translateX} panHandlers={defaultPanHandlers}
        now={now} onCarouselLayout={jest.fn()} savedEvent={savedEvent} />
    );
    try {
      const view = await render(makeView(null));
      scrollTo.mockClear();
      await view.rerender(makeView({ id: 'event-1', date: day1.date, revision: 1 }));
      expect(scrollTo).toHaveBeenCalledWith({ y: 14.5 * HOUR_HEIGHT * 4 - TIMELINE_HEIGHT * 0.2, animated: false });
      expect(view.getByTestId('timeline-event.event-1.saved')).toBeOnTheScreen();
      expect(view.queryByTestId('timeline-event.earlier.saved')).toBeNull();
      scrollTo.mockClear();
      await view.rerender(makeView(null));
      expect(view.queryByTestId('timeline-event.event-1.saved')).toBeNull();
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      scrollPort.mockRestore();
    }
  });

  it('ダブルタップの途中に複数指操作が挟まっても予定を追加しない', async () => {
    const onCreateExactAt = jest.fn();
    const view = await renderTwoDayView({ onCreateExactAt });
    const column = view.getAllByTestId('two-day-calendar.timeline-column')[1];
    await fireEvent(column, 'touchEnd', { nativeEvent: { locationY: 100, touches: [] } });
    await fireEvent(column, 'touchStart', { nativeEvent: { touches: [{}, {}] } });
    await fireEvent(column, 'touchEnd', { nativeEvent: { locationY: 100, touches: [{}] } });
    await fireEvent(column, 'touchEnd', { nativeEvent: { locationY: 100, touches: [] } });
    expect(onCreateExactAt).not.toHaveBeenCalled();
    await fireEvent(column, 'touchStart', { nativeEvent: { touches: [{}] } });
    await fireEvent(column, 'touchEnd', { nativeEvent: { locationY: 100, touches: [] } });
    expect(onCreateExactAt).not.toHaveBeenCalled();
  });
  it('週表示は7列に密集予定の省略件数を示して対象日を開く', async () => {
    const onOpenDay = jest.fn();
    const weekStrip = Array.from({ length: 21 }, (_, index) => ({ ...day1, date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      timelineItems: [timelineItem, { ...timelineItem, id: 'second' }], allDayItems: [] }));
    const view = await render(<TwoDayView visibleDayCount={7} strip={weekStrip} selectedDate="2026-09-08" bufferDays={7}
      columnWidth={342 / 7} translateX={new Animated.Value(-342)} panHandlers={defaultPanHandlers} onCarouselLayout={jest.fn()} onOpenDay={onOpenDay} />);
    expect(view.getByTestId('week-calendar')).toBeOnTheScreen();
    expect(view.getAllByText('他1件')).toHaveLength(7);
    await userEvent.setup().press(within(view.getByTestId('week-day-header.2026-09-08')).getByRole('button'));
    expect(onOpenDay).toHaveBeenCalledWith('2026-09-08');
    expect(view.getAllByTestId('two-day-calendar.timeline-column')).toHaveLength(7);
  });
  it('1日表示は予備列を含む3列で当日の件数と日付を表示する', async () => {
    const view = await render(<TwoDayView visibleDayCount={1} strip={[prevBuffer, { ...day1, allDayItems: [allDayItem] }, day2]}
      bufferDays={1} columnWidth={390} translateX={new Animated.Value(-390)} panHandlers={defaultPanHandlers} onCarouselLayout={jest.fn()} />);
    expect(view.getByTestId('single-day-calendar')).toBeOnTheScreen();
    expect(view.getByText('9月8日（火）')).toBeOnTheScreen();
    expect(view.getByText('休暇')).toHaveStyle({ fontWeight: '700' });
    expect(view.queryByText('9月7日（月）')).toBeNull();
  });
  it.each([1, 2, 7] as const)('%i日表示で3件ある日は1件と「ほか2件」を出し、発生回を開く', async (visibleDayCount) => {
    const onEditEvent = jest.fn();
    const items = Array.from({ length: 3 }, (_, index) => ({ ...allDayItem, id: `series:${index}`, eventId: 'series',
      originalOccurrenceDate: '2026-09-06', title: `予定${index}`, accessibilityLabel: `予定${index}、終日` }));
    const view = await render(<TwoDayView visibleDayCount={visibleDayCount} strip={[{ ...day1, allDayItems: items }, day2]}
      bufferDays={0} columnWidth={visibleDayCount === 7 ? 46 : 170} translateX={new Animated.Value(0)} panHandlers={defaultPanHandlers}
      onCarouselLayout={jest.fn()} onEditEvent={onEditEvent} />);
    expect(view.getAllByText(/^予定[0-2]$/)).toHaveLength(1);
    expect(view.queryByText('予定2')).toBeNull();
    await userEvent.setup().press(view.getByRole('button', { name: /9月8日.*ほか2件/ }));
    const sheet = within(view.getByTestId('all-day-list.panel'));
    expect(sheet.getByRole('header', { name: '9月8日の終日予定' })).toBeOnTheScreen();
    expect(sheet.getAllByText(/^予定[0-2]$/)).toHaveLength(3);
    await userEvent.setup().press(sheet.getByRole('button', { name: '予定2、終日' }));
    expect(onEditEvent).toHaveBeenCalledWith('series', '2026-09-06');
    expect(view.queryByTestId('all-day-list.panel')).toBeNull();
  });
  it.each([1, 2, 7] as const)('%i日表示の終日欄は移動後に2行へ広がり、戻ると1行に縮む', async (visibleDayCount) => {
    jest.mocked(useReduceMotion).mockReturnValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    try {
      const translateX = new Animated.Value(0);
      const busyDay = { ...day2, allDayItems: Array.from({ length: 5 }, (_, index) =>
        ({ ...allDayItem, id: `event-${index}` })) };
      const createCalendar = (withItems: boolean) => <TwoDayView visibleDayCount={visibleDayCount}
        strip={withItems ? [busyDay, day1] : [day1, day2]} bufferDays={0} columnWidth={100} translateX={translateX}
        panHandlers={defaultPanHandlers} onCarouselLayout={jest.fn()} />;
      const view = await render(createCalendar(false));
      const height = () => StyleSheet.flatten(view.getByTestId('two-day-calendar.summary').props.style).height;
      const rowHeight = StyleSheet.flatten(view.getAllByTestId('two-day-calendar.all-day-region')[0].props.style).height / 2;
      const before = height();
      await act(() => translateX.setValue(-50));
      expect(height()).toBe(before);

      timing.mockClear();
      await view.rerender(createCalendar(true));
      expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: rowHeight * 2, duration: 220 }));
      await waitFor(() => expect(height()).toBe(before + rowHeight));
      await view.rerender(createCalendar(false));
      expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: rowHeight, duration: 220 }));
      await waitFor(() => expect(height()).toBe(before));
    } finally {
      timing.mockRestore();
      jest.mocked(useReduceMotion).mockReturnValue(true);
    }
  });
  it.each([1, 2] as const)('%i日表示は周辺6時間を初期表示し、全体と500msで切り替える', async (visibleDayCount) => {
    jest.mocked(useReduceMotion).mockReturnValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    try {
      const view = await renderTwoDayView({ focused: true, visibleDayCount, now: () => new Date(2026, 8, 8, 10, 0) });
      const scroll = view.getByTestId('two-day-calendar.timeline-scroll');
      const axis = view.getByTestId('two-day-calendar.timeline-axis');
      expect(view.getByRole('button', { name: '6時間' })).toBeSelected();
      expect(scroll.props.contentOffset.y).toBeCloseTo(7 * 4 * HOUR_HEIGHT);
      expect(StyleSheet.flatten(axis.props.style).height).toBe(TIMELINE_HEIGHT * 4);

      await fireEvent.press(view.getByRole('button', { name: '24時間' }));
      expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 500 }));
      await waitFor(() => expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.timeline-axis').props.style).height)
        .toBe(TIMELINE_HEIGHT), { timeout: 1500 });
      await fireEvent.press(view.getByRole('button', { name: '6時間' }));
      expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 500, toValue: 4 }));
      await waitFor(() => expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.timeline-axis').props.style).height)
        .toBe(TIMELINE_HEIGHT * 4), { timeout: 1500 });
    } finally {
      timing.mockRestore();
      jest.mocked(useReduceMotion).mockReturnValue(true);
    }
  });
  it('未選択の表示倍率も本文色で読め、押して選択状態を切り替えられる', async () => {
    const view = await renderTwoDayView({ focused: true });
    expect(view.getByRole('button', { name: '6時間' })).toBeSelected();
    expect(view.getByRole('button', { name: '24時間' })).toBeEnabled();
    expect(StyleSheet.flatten(view.getByText('24時間').props.style).color).toBe(Colors.light.text);
    await fireEvent.press(view.getByRole('button', { name: '24時間' }));
    expect(view.getByRole('button', { name: '24時間' })).toBeSelected();
    expect(view.getByRole('button', { name: '6時間' })).toBeEnabled();
  });

  it.each([[2, 59, 0], [3, 30, 0.5], [23, 59, 18]])('現在時刻が%i時%i分なら6時間枠を%i時から表示する', async (hour, minute, startHour) => {
    const view = await renderTwoDayView({ focused: true, now: () => new Date(2026, 8, 8, hour, minute) });
    expect(view.getByTestId('two-day-calendar.timeline-scroll').props.contentOffset.y)
      .toBeCloseTo(startHour * 4 * HOUR_HEIGHT);
  });

  it('予備列を含む全列を横並びで描画し、共通24時間軸・終日見出し・予定・祝日未対応を示す', async () => {
    const view = await renderTwoDayView({
      now: () => new Date(2026, 8, 8, 10, 0),
    });
    expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.summary').props.style)).toMatchObject({
      flexDirection: 'row',
    });
    expect(view.getAllByTestId('two-day-calendar.column')).toHaveLength(strip.length);
    expect(view.getByTestId('two-day-calendar.timeline')).toBeOnTheScreen();
    // 現在時刻が0:00の場合は時間軸と現在時刻ラベルの両方が存在し得る。
    expect(view.getAllByText('0:00').length).toBeGreaterThanOrEqual(1);
    expect(view.getAllByText('21:00').length).toBeGreaterThanOrEqual(1);
    expect(view.getByText('24:00')).toBeOnTheScreen();
    // 現在時刻と重なる定時ラベルは、現在時刻を読みやすくするため非表示になる。
    expect(view.getAllByTestId('two-day-calendar.hour-label')).toHaveLength(24);
    expect(view.getByLabelText('歯医者、14:30・30分')).toBeOnTheScreen();
    expect(view.getByTestId('two-day-calendar.all-day-caption')).toHaveTextContent('終日');
    expect(view.queryByText('予定はありません')).toBeNull();
    expect(view.getByText('祝日情報未対応')).toBeOnTheScreen();
  });

  it('曜日と日付数字をcompactに表示し、今日を文字ではなく円で示す', async () => {
    const view = await renderTwoDayView();

    expect(view.getByText('火')).toBeOnTheScreen();
    expect(view.getByText('8')).toBeOnTheScreen();
    expect(view.queryByText('今日')).toBeNull();
    expect(view.getByLabelText(/今日/)).toBeOnTheScreen();
    expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.today-circle').props.style)).toMatchObject({
      width: 34,
      height: 34,
      borderRadius: Radii.full,
    });
  });

  it('タイムライン上の発生回をタップすると表示keyではなく元シリーズIDを渡す', async () => {
    const onEditEvent = jest.fn();
    const recurringItem = {
      ...timelineItem,
      id: 'series-1:recurrence:2026-09-08',
      eventId: 'series-1',
      accessibilityLabel: '歯医者、14:30・30分、繰り返し予定',
    };
    const view = await renderTwoDayView({
      onEditEvent,
      strip: [prevBuffer, { ...day1, timelineItems: [recurringItem] }, day2, nextBuffer],
    });

    fireEvent.press(view.getByLabelText('歯医者、14:30・30分、繰り返し予定'));

    expect(onEditEvent).toHaveBeenCalledWith('series-1');
    expect(view.getByTestId('timeline-event.series-1:recurrence:2026-09-08'))
      .toBeOnTheScreen();
  });

  it('2日ビューの終日予定をタップすると編集対象のIDを渡す', async () => {
    const onEditEvent = jest.fn();
    const view = await renderTwoDayView({
      onEditEvent,
      strip: [prevBuffer, { ...day1, allDayItems: [allDayItem] }, day2, nextBuffer],
    });

    fireEvent.press(view.getByLabelText('休暇、終日'));

    expect(onEditEvent).toHaveBeenCalledWith('all-day-event');
  });

  it('相対予定を期間ラベルと連続位置を持つ破線項目で示す', async () => {
    const fuzzyRangeItem = {
      ...allDayItem,
      kind: 'fuzzyRange' as const,
      id: 'relative-range',
      eventId: 'relative-range',
      title: '今週やること',
      temporalLabel: '今週中・9月8日〜9月11日',
      rangePosition: 'start' as const,
      accessibilityLabel: '今週やること、今週中・9月8日〜9月11日、相対予定、期間の開始',
    };
    const view = await renderTwoDayView({
      strip: [prevBuffer, { ...day1, allDayItems: [fuzzyRangeItem] }, day2, nextBuffer],
    });

    expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.fuzzy-range.relative-range').props.style))
      .toMatchObject({ borderStyle: 'dashed', borderTopRightRadius: 0 });
    expect(view.getByText('今週中・9月8日〜9月11日')).toBeOnTheScreen();
  });

  it('予備列から続く複数日予定のラベルを表示中の列へ寄せる', async () => {
    const fuzzyRangeItem = {
      ...allDayItem,
      kind: 'fuzzyRange' as const,
      id: 'relative-range',
      eventId: 'relative-range',
      title: '今週やること',
      temporalLabel: '今週中',
      rangePosition: 'middle' as const,
      accessibilityLabel: '今週やること、今週中、期間の途中',
    };
    const view = await renderTwoDayView({
      strip: [
        { ...prevBuffer, allDayItems: [fuzzyRangeItem] },
        { ...day1, allDayItems: [fuzzyRangeItem] },
        { ...day2, allDayItems: [fuzzyRangeItem] },
        nextBuffer,
      ],
    });

    expect(StyleSheet.flatten(view.getByText('今週やること').parent?.props.style)).toMatchObject({ left: COLUMN_WIDTH + 6 });
  });

  it('祝日を終日領域の読み取り専用項目として表示し、日付ヘッダーの高さを変えない', async () => {
    const onEditEvent = jest.fn();
    const view = await renderTwoDayView({
      onEditEvent,
      strip: [prevBuffer, {
        ...day1,
        holidayName: 'テスト記念日',
        allDayItems: [holidayItem, allDayItem],
      }, day2, nextBuffer],
    });

    const holiday = view.getByLabelText('テスト記念日、祝日');
    expect(holiday.props.accessibilityRole).toBe('text');
    expect(view.queryByRole('button', { name: 'テスト記念日、祝日' })).toBeNull();
    expect(view.getByRole('button', { name: '休暇、終日' })).toBeOnTheScreen();
    const holidayStyle = StyleSheet.flatten(holiday.props.style);
    expect(holidayStyle.backgroundColor).toBe(Colors.light.backgroundElement);
    expect(holidayStyle.borderLeftWidth).toBeFalsy();
    expect(StyleSheet.flatten(view.getByText('テスト記念日').props.style).color).toBe(Colors.light.calendarHoliday);
    expect(view.queryByTestId('two-day-calendar.all-day-segment.holiday:2026-09-08.gradient', {
      includeHiddenElements: true,
    })).toBeNull();
    const allDayStyle = StyleSheet.flatten(view.getByRole('button', { name: '休暇、終日' }).props.style);
    expect(allDayStyle).toMatchObject({ backgroundColor: '#185ABC', borderRadius: 8 });
    expect(view.queryByTestId('two-day-calendar.all-day-segment.all-day-event.gradient', {
      includeHiddenElements: true,
    })).toBeNull();
    const headers = view.getAllByTestId('two-day-calendar.date-header');
    expect(new Set(headers.map((header) => StyleSheet.flatten(header.props.style).minHeight)).size).toBe(1);
    const allDayRegions = view.getAllByTestId('two-day-calendar.all-day-region');
    expect(allDayRegions).toHaveLength(4);
    allDayRegions.forEach((region) => {
      expect(StyleSheet.flatten(region.props.style)).toMatchObject({
        flexShrink: 0,
        borderBottomWidth: StyleSheet.hairlineWidth,
      });
    });
    expect(onEditEvent).not.toHaveBeenCalled();
  });

  it('2行目の一覧ボタンは省略した4件を示す', async () => {
    const extraItems = ['event-2', 'event-3', 'event-4'].map((id, index) => ({
      ...allDayItem,
      id,
      eventId: id,
      title: `終日予定${index + 2}`,
      accessibilityLabel: `終日予定${index + 2}、終日`,
    }));
    const view = await renderTwoDayView({
      strip: [prevBuffer, {
        ...day1,
        allDayItems: [holidayItem, allDayItem, ...extraItems],
      }, day2, nextBuffer],
    });

    expect(view.getByLabelText('テスト記念日、祝日')).toBeOnTheScreen();
    expect(view.queryByLabelText('休暇、終日')).toBeNull();
    expect(view.getByText('ほか4件')).toBeOnTheScreen();
  });

  it('タイムラインの空き領域をダブルタップすると最も近い正時で予定を作成する', async () => {
    const onCreateExactAt = jest.fn();
    const view = await renderTwoDayView({ onCreateExactAt });
    const now = jest.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValue(1_200);
    const column = view.getAllByTestId('two-day-calendar.timeline-column')[1];

    await fireEvent(column, 'touchEnd', { nativeEvent: { locationY: HOUR_HEIGHT * 10 } });
    await fireEvent(column, 'touchEnd', { nativeEvent: { locationY: HOUR_HEIGHT * 10 } });

    expect(onCreateExactAt).toHaveBeenCalledWith('2026-09-08', '10:00');
    now.mockRestore();
  });

  it('予備列も含めた幅でストリップを配置し、渡されたtranslateXで横方向へ動かす', async () => {
    const translateX = new Animated.Value(-195);
    const view = await render(
      <TwoDayView strip={strip} bufferDays={BUFFER_DAYS} columnWidth={COLUMN_WIDTH} translateX={translateX}
        panHandlers={defaultPanHandlers} onCarouselLayout={jest.fn()} />,
    );

    const stripStyle = StyleSheet.flatten(view.getByTestId('two-day-calendar.summary-strip').props.style);
    expect(stripStyle.width).toBe(strip.length * COLUMN_WIDTH);
    expect(stripStyle.transform[0].translateX).toBeDefined();
  });

  it('週の7列と前後週の予備列を時間軸と見出しで同じ実測幅にそろえる', async () => {
    const week = Array.from({ length: 21 }, (_, index) => ({
      ...day1, date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    }));
    const columnWidth = 382 / 7;
    const view = await render(<TwoDayView visibleDayCount={7} strip={week} bufferDays={7}
      columnWidth={columnWidth} translateX={new Animated.Value(-382)} panHandlers={defaultPanHandlers}
      onCarouselLayout={jest.fn()} />);
    const headings = view.getAllByTestId(/^week-day-header\./);
    const columns = view.getAllByTestId('two-day-calendar.timeline-column');
    expect(headings).toHaveLength(7);
    expect(columns).toHaveLength(7);
    for (const column of [...headings, ...columns]) {
      expect(StyleSheet.flatten(column.props.style).width).toBe(columnWidth);
    }
    expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.timeline-strip').props.style).width).toBe(1146);
  });

  it('時間軸(48pt)を除いた、実際に日付列が占める幅をカルーセルへ通知する', async () => {
    const onCarouselLayout = jest.fn();
    const view = await render(
      <TwoDayView strip={strip} bufferDays={BUFFER_DAYS} columnWidth={COLUMN_WIDTH}
        translateX={new Animated.Value(-195)} panHandlers={defaultPanHandlers} onCarouselLayout={onCarouselLayout}
        />,
    );

    // ルート(two-day-calendar)全体の幅ではなく、時間軸の48pt分の余白を
    // 除いた日付列の表示領域(viewport)の幅を通知する必要がある。
    // ルートの幅をそのまま使うと、右側の列が画面からはみ出してしまう。
    await fireEvent(view.getByTestId('two-day-calendar.day-columns-viewport'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 342, height: 800 } },
    });

    expect(onCarouselLayout).toHaveBeenCalledWith(342);
  });

  it('画面のどこからでも横スワイプを受け付けられるよう、受付領域全体へpanHandlersを適用する', async () => {
    const panHandlers = { ...defaultPanHandlers, onStartShouldSetResponder: () => true };
    const view = await render(
      <TwoDayView strip={strip} bufferDays={BUFFER_DAYS} columnWidth={COLUMN_WIDTH}
        translateX={new Animated.Value(-195)} panHandlers={panHandlers} onCarouselLayout={jest.fn()}
        />,
    );

    expect(view.getByTestId('two-day-calendar').props.onStartShouldSetResponder).toBeDefined();
  });

  it('位置と重複幅を描画へ渡し、濃淡がある予定帯だけフェードする', async () => {
    const opacityPatterns = [
      [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }],
      [{ offset: 0, opacity: 0 }, { offset: 0.25, opacity: 1 }, { offset: 1, opacity: 1 }],
      [{ offset: 0, opacity: 1 }, { offset: 0.75, opacity: 1 }, { offset: 1, opacity: 0 }],
      [{ offset: 0, opacity: 0 }, { offset: 0.5, opacity: 1 }, { offset: 1, opacity: 0 }],
    ] as const;
    const gradientItems = opacityPatterns.map((opacityStops, index) => ({
      ...timelineItem,
      id: `gradient-${index}`,
      title: `予定${index + 1}`,
      accessibilityLabel: `予定${index + 1}、午後`,
      top: 100 + index * 50,
      overlapIndex: index % 2,
      overlapCount: 2,
      opacityStops,
    }));
    const view = await renderTwoDayView({
      strip: [prevBuffer, { ...day1, timelineItems: gradientItems }, day2, nextBuffer],
    });

    gradientItems.forEach((item) => {
      const blockStyle = StyleSheet.flatten(view.getByTestId(`timeline-event.${item.id}`).props.style);
      expect(blockStyle).toMatchObject({ top: item.top, height: item.height, width: '50%' });
      const gradient = view.queryByTestId(`timeline-event.${item.id}.gradient`, { includeHiddenElements: true });
      if (item.id === 'gradient-0') {
        expect(gradient).toBeNull();
      } else {
        expect(gradient?.props.locations).toEqual(item.opacityStops.map((stop) => stop.offset));
        expect(gradient?.props.colors).toHaveLength(item.opacityStops.length);
      }
    });
  });

  it('フェードする予定には淡い色の下地を置き、両端の透明度は維持する', async () => {
    const fades = [{ offset: 0, opacity: 0 }, { offset: 0.5, opacity: 1 }, { offset: 1, opacity: 0 }];
    const view = await renderTwoDayView({
      strip: [prevBuffer, { ...day1, timelineItems: [{ ...timelineItem, opacityStops: fades }] }, day2, nextBuffer],
    });
    const cardStyle = StyleSheet.flatten(view.getByTestId('timeline-event.event-1.card').props.style);
    expect(cardStyle.backgroundColor).toMatch(/^rgba\(\d+, \d+, \d+, 0\.08\)$/);
    const gradient = view.getByTestId('timeline-event.event-1.gradient', { includeHiddenElements: true });
    expect(gradient.props.colors[0]).toMatch(/, 0\)$/);
    expect(gradient.props.colors[2]).toMatch(/, 0\)$/);
  });

  it('予定テキストを不透明度が最も濃い部分へ寄せて配置する', async () => {
    const anchorPatterns = [
      { opacityStops: [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 0 }], expected: 'flex-start' },
      { opacityStops: [{ offset: 0, opacity: 0 }, { offset: 1, opacity: 1 }], expected: 'flex-end' },
      { opacityStops: [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }], expected: 'flex-start' },
    ] as const;
    const items = anchorPatterns.map(({ opacityStops }, index) => ({
      ...timelineItem,
      id: `anchor-${index}`,
      opacityStops,
    }));
    const view = await renderTwoDayView({ strip: [prevBuffer, { ...day1, timelineItems: items }, day2, nextBuffer] });

    anchorPatterns.forEach(({ expected }, index) => {
      const textContainer = view.getByTestId(`timeline-event.anchor-${index}.text`);
      expect(StyleSheet.flatten(textContainer.props.style)).toMatchObject({ justifyContent: expected });
    });
  });

  it('計測した画面高さに合わせて24時間軸・時間線・予定の位置と高さを縮小する', async () => {
    const view = await renderTwoDayView();

    await fireEvent(view.getByTestId('two-day-calendar.timeline'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: TIMELINE_HEIGHT / 2 + 2 * axisPadding(view) } },
    });

    expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.timeline-axis').props.style))
      .toMatchObject({ height: TIMELINE_HEIGHT / 2 });
    for (const column of view.getAllByTestId('two-day-calendar.timeline-column')) {
      expect(StyleSheet.flatten(column.props.style)).toMatchObject({ height: TIMELINE_HEIGHT / 2 });
    }
    const hourLineAt3 = view.getAllByTestId('two-day-calendar.hour-line')[3];
    expect(StyleSheet.flatten(hourLineAt3.props.style)).toMatchObject({ top: 3 * HOUR_HEIGHT * 0.5 });
    // 812 * 0.5 = 406(縮小後の開始位置)。高さは36の半分(18)が最小表示高(36)を下回るため36のまま。
    expect(StyleSheet.flatten(view.getByTestId('timeline-event.event-1').props.style))
      .toMatchObject({ top: 406, height: 36 });
  });

  it('fit倍率では縦scrollせず、拡大後だけscrollして初期高さ未満へ縮小しない', async () => {
    const view = await renderTwoDayView();
    const timeline = view.getByTestId('two-day-calendar.timeline');
    await fireEvent(timeline, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: TIMELINE_HEIGHT / 2 + 2 * axisPadding(view) } },
    });

    expect(view.getByTestId('two-day-calendar.timeline-scroll').props.scrollEnabled).toBe(false);
    const zoom = view.getByTestId('two-day-calendar.timeline-zoom');
    expect(within(zoom).queryByLabelText('歯医者、14:30・30分')).toBeNull();
    expect(zoom.props.accessibilityActions).toEqual([
      { name: 'increment', label: '拡大' },
      { name: 'decrement', label: '縮小' },
    ]);
    await fireEvent(zoom, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(view.getByTestId('two-day-calendar.timeline-scroll').props.scrollEnabled).toBe(true);
    expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.timeline-axis').props.style).height)
      .toBeGreaterThan(TIMELINE_HEIGHT / 2);

    for (let index = 0; index < 10; index += 1) {
      await fireEvent(zoom, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    }
    expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.timeline-axis').props.style).height)
      .toBe(TIMELINE_HEIGHT / 2);
  });

  it('拡大後も予定tapと空き領域double tapを維持する', async () => {
    const onEditEvent = jest.fn();
    const onCreateExactAt = jest.fn();
    const view = await renderTwoDayView({ onEditEvent, onCreateExactAt });
    await fireEvent(view.getByTestId('two-day-calendar.timeline'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: TIMELINE_HEIGHT / 2 + 2 * axisPadding(view) } },
    });
    await fireEvent(view.getByTestId('two-day-calendar.timeline-zoom'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await waitFor(() => {
      expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.timeline-axis').props.style).height)
        .toBeCloseTo(TIMELINE_HEIGHT * 2);
    });

    await fireEvent.press(view.getByLabelText('歯医者、14:30・30分'));
    const now = jest.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValue(1_200);
    const column = view.getAllByTestId('two-day-calendar.timeline-column')[1];
    await fireEvent(column, 'touchEnd', { nativeEvent: { locationY: HOUR_HEIGHT * 2 * 10 } });
    await fireEvent(column, 'touchEnd', { nativeEvent: { locationY: HOUR_HEIGHT * 2 * 10 } });

    expect(onEditEvent).toHaveBeenCalledWith('event-1');
    expect(onCreateExactAt).toHaveBeenCalledWith('2026-09-08', '10:00');
    now.mockRestore();
  });

  it('日末の短い予定でも下端で切れないよう、最小表示高を保ったまま位置を内側へ寄せる', async () => {
    // 23:59の瞬間予定。top(1343.06) + 最小表示高(36)が24時間分の高さ(1344)を超えるため、
    // overflow: 'hidden'で下部が切れてしまう。
    const lateItem = {
      ...timelineItem,
      id: 'late-event',
      startMinute: 1439,
      endMinute: 1439,
      top: 1439 * (HOUR_HEIGHT / 60),
      height: MIN_EVENT_HEIGHT,
      isInstant: true,
    };
    const view = await renderTwoDayView({
      strip: [prevBuffer, { ...day1, timelineItems: [lateItem] }, day2, nextBuffer],
    });

    const style = StyleSheet.flatten(view.getByTestId('timeline-event.late-event').props.style);
    // 高さは最小表示高を保ち、視認・タップできる状態を維持する。
    expect(style.height).toBe(MIN_EVENT_HEIGHT);
    // 位置を上へ寄せて、ブロック全体が下端の内側へ収まるようにする。
    expect(style.top + style.height).toBeLessThanOrEqual(TIMELINE_HEIGHT);
  });

  it('0時・中間・24時のラベルを罫線の中心に合わせ、端にも余白を設ける', async () => {
    const view = await renderTwoDayView({ now: () => new Date(2026, 8, 8, 10, 30) });
    const lines = view.getAllByTestId('two-day-calendar.hour-line').slice(0, 25);
    const scroll = StyleSheet.flatten(view.getByTestId('two-day-calendar.timeline-scroll').props.contentContainerStyle);
    for (const hour of [0, 12, 24]) {
      const line = StyleSheet.flatten(lines[hour].props.style);
      const label = StyleSheet.flatten(view.getByText(`${hour}:00`).props.style);
      expect(label.top + label.lineHeight / 2).toBeCloseTo(line.top + line.height / 2);
      expect(label.top + scroll.paddingTop).toBeGreaterThanOrEqual(0);
      expect(label.top + label.lineHeight + scroll.paddingTop).toBeLessThanOrEqual(scroll.height);
    }
  });

  it('罫線はすべて同じ太さにし、1時間ごとに物理ピクセルへ吸着した位置へ配置する', async () => {
    const view = await renderTwoDayView();

    // 1時間 = 21.5pt となり、ptのままでは1本おきに半ピクセル境界へ落ちる高さ。
    await fireEvent(view.getByTestId('two-day-calendar.timeline'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 516 + 2 * axisPadding(view) } },
    });
    const scale = computeTimelineScale(516);

    const hourLinesOfFirstColumn = view.getAllByTestId('two-day-calendar.hour-line').slice(0, 25);
    hourLinesOfFirstColumn.slice(0, 24).forEach((line, hour) => {
      const style = StyleSheet.flatten(line.props.style);
      expect(style.height).toBe(StyleSheet.hairlineWidth);
      expect(style.top).toBe(computeHourLineTop(hour, scale));
      expect(PixelRatio.roundToNearestPixel(style.top)).toBe(style.top);
    });
  });

  it('24:00の罫線が下端でクリップされないよう、線の太さ分だけ内側へ収める', async () => {
    const view = await renderTwoDayView();

    await fireEvent(view.getByTestId('two-day-calendar.timeline'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 516 + 2 * axisPadding(view) } },
    });
    const columnHeight = TIMELINE_HEIGHT * computeTimelineScale(516);

    // 24:00の線はtopが列の高さと同じになり、overflow:'hidden'で全体が消える。
    const lastLine = view.getAllByTestId('two-day-calendar.hour-line').slice(0, 25)[24];
    const style = StyleSheet.flatten(lastLine.props.style);
    expect(style.top + style.height).toBeLessThanOrEqual(columnHeight);
    // 内側へ寄せた後も物理ピクセルに揃い、薄れて見えないようにする。
    expect(PixelRatio.roundToNearestPixel(style.top)).toBe(style.top);
  });

  it('時間線を予定の背後、現在時刻線を予定の前面に描画する', async () => {
    const view = await renderTwoDayView({ now: () => new Date(2026, 8, 8, 14, 30) });

    const hourLineZIndex = StyleSheet.flatten(
      view.getAllByTestId('two-day-calendar.hour-line')[0].props.style,
    ).zIndex;
    const eventZIndex = StyleSheet.flatten(
      view.getByTestId('timeline-event.event-1').props.style,
    ).zIndex;
    const nowLineZIndex = StyleSheet.flatten(
      view.getByTestId('two-day-calendar.now-line').props.style,
    ).zIndex;
    expect(hourLineZIndex).toBeLessThan(eventZIndex);
    expect(eventZIndex).toBeLessThan(nowLineZIndex);
    // 罫線は表示のみが目的で、下にある予定へのタップ操作を妨げてはならない。
    expect(view.getAllByTestId('two-day-calendar.hour-line')[0].props.pointerEvents).toBe('none');
  });

  it('薄い区間にある複数日予定の文字を通常の本文色で背景を覆わずに表示する', async () => {
    const fuzzy = { ...allDayItem, kind: 'fuzzyRange' as const, rangePosition: 'start' as const,
      rangeStartDate: day1.date, rangeThroughDate: '2026-09-15', fadeInRatio: 1, fadeOutRatio: 0 };
    const view = await renderTwoDayView({ strip: [prevBuffer, { ...day1, allDayItems: [fuzzy] }, day2, nextBuffer] });
    const label = StyleSheet.flatten(view.getByText('休暇').props.style);
    expect(label.backgroundColor ?? 'transparent').toBe('transparent');
    expect(label.color).toBe(Colors.light.text);
    expect(label.textShadowColor).toBeUndefined();
    const gradient = view.getByTestId('two-day-calendar.fuzzy-range.all-day-event.gradient', {
      includeHiddenElements: true,
    });
    expect(gradient.props.locations).toEqual([0, 1]);
    expect(gradient.props.colors).toEqual(['#185ABC00', '#185ABC20']);
  });

  it('不透明な時刻予定を指定色の単色で塗る', async () => {
    const view = await renderTwoDayView();
    const cardStyle = StyleSheet.flatten(view.getByTestId('timeline-event.event-1.card').props.style);
    expect(cardStyle.backgroundColor).toBe('#B3261E');
    expect(view.queryByTestId('timeline-event.event-1.gradient', { includeHiddenElements: true })).toBeNull();
    expect(StyleSheet.flatten(view.getByText('歯医者').props.style).backgroundColor ?? 'transparent').toBe('transparent');
  });

  it('補助時刻を倍率に合わせてフェードし、現在時刻と重なる定時を隠す', async () => {
    const view = await render(
      <TimelineAxis scale={0.72} now={{ top: computeHourLineTop(14, 0.72), label: '14:00' }} />,
    );
    expect(StyleSheet.flatten(view.getByText('13:00').props.style).opacity).toBeCloseTo(0.5, 10);
    expect(view.getAllByText('14:00')).toHaveLength(1);
  });

  it('時間軸に現在時刻を表示し、日付列全体に1本の赤線を引く', async () => {
    const view = await renderTwoDayView({ now: () => new Date(2026, 8, 8, 14, 30) });

    expect(view.getByText('14:30')).toBeOnTheScreen();
    const nowLines = view.getAllByTestId('two-day-calendar.now-line');
    expect(nowLines).toHaveLength(1);
    expect(view.getAllByTestId('two-day-calendar.now-dot')).toHaveLength(1);
    expect(StyleSheet.flatten(nowLines[0].props.style)).toMatchObject({ top: 870 * (HOUR_HEIGHT / 60), left: 0, right: 0 });
  });

  it('23時台後半でも現在時刻線が下端で切れないよう、線の太さ分だけ内側へ収める', async () => {
    const view = await renderTwoDayView({ now: () => new Date(2026, 8, 8, 23, 59) });

    const style = StyleSheet.flatten(view.getAllByTestId('two-day-calendar.now-line')[0].props.style);
    expect(style.top + style.height).toBeLessThanOrEqual(TIMELINE_HEIGHT);
  });

  it.each([1, 2, 7] as const)('%i日表示で今日を含まなくても、現在時刻と赤線を表示する', async (visibleDayCount) => {
    const notToday = strip.map((day) => ({ ...day, isToday: false }));
    const view = await render(<TwoDayView strip={notToday} bufferDays={1} visibleDayCount={visibleDayCount}
      columnWidth={COLUMN_WIDTH} translateX={new Animated.Value(-COLUMN_WIDTH)}
      panHandlers={defaultPanHandlers} onCarouselLayout={jest.fn()} now={() => new Date(2026, 8, 8, 14, 30)} />);
    expect(view.getByLabelText('現在時刻14:30')).toBeOnTheScreen();
    expect(view.getByTestId('two-day-calendar.now-line').props.pointerEvents).toBe('none');
  });

  it('横移動中に今日が画面外へ出ても、現在時刻と赤線がその位置に残る', async () => {
    const bufferIsToday = [{ ...prevBuffer, isToday: true }, { ...day1, isToday: false }, day2, nextBuffer];
    const translateX = new Animated.Value(0);
    const view = await render(<TwoDayView strip={bufferIsToday} bufferDays={1} columnWidth={COLUMN_WIDTH}
      translateX={translateX} panHandlers={defaultPanHandlers} onCarouselLayout={jest.fn()}
      now={() => new Date(2026, 8, 8, 14, 30)} />);
    const label = () => StyleSheet.flatten(view.getByTestId('two-day-calendar.now-label').props.style);
    const line = () => StyleSheet.flatten(view.getByTestId('two-day-calendar.now-line').props.style);
    const before = { label: label(), line: line() };
    await act(() => translateX.setValue(-COLUMN_WIDTH));
    expect({ label: label(), line: line() }).toEqual(before);
  });

  it('予定ブロックに枠線を描画しない', async () => {
    const view = await renderTwoDayView();

    const card = view.getByTestId('timeline-event.event-1.card');
    expect(StyleSheet.flatten(card.props.style).borderWidth).toBeFalsy();
  });

  it('予定を小さい角丸と背景色の本文色で表示する', async () => {
    const view = await renderTwoDayView();

    expect(StyleSheet.flatten(view.getByTestId('timeline-event.event-1.card').props.style)).toMatchObject({
      borderRadius: 8,
      overflow: 'hidden',
    });
    expect(StyleSheet.flatten(view.getByText('歯医者').props.style)).toMatchObject({
      fontWeight: '700',
      color: Colors.light.background,
    });
    expect(StyleSheet.flatten(view.getByText('14:30・30分').props.style)).toMatchObject({
      color: Colors.light.background,
    });
  });

  it('日をまたぐ時刻予定は前日と翌日へ続く辺の角丸を外す', async () => {
    const continuedDay = { ...day1, timelineItems: [{
      ...timelineItem,
      continuesFromPreviousDay: true,
      continuesToNextDay: true,
    }] };
    const view = await renderTwoDayView({ strip: [prevBuffer, continuedDay, day2, nextBuffer] });

    expect(StyleSheet.flatten(view.getByTestId('timeline-event.event-1.card').props.style)).toMatchObject({
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    });
  });

  it('予定追加をインラインのラベル付きボタンとして表示する', async () => {
    const view = await render(<CalendarAddEventButton onPress={jest.fn()} />);
    const button = view.getByRole('button', { name: '予定を追加' });
    expect(button).toHaveTextContent('予定を追加');
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ minHeight: 44 });
    expect(StyleSheet.flatten(button.props.style).position).toBeUndefined();
  });

  it('2日ビュー上部には予定追加ボタンを表示しない', async () => {
    const view = await renderTwoDayView();
    expect(view.queryByText('＋ 予定')).toBeNull();
  });

});

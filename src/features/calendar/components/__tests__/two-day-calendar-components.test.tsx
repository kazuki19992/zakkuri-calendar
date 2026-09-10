import { fireEvent, render, userEvent } from '@testing-library/react-native';
import { Animated, PixelRatio, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import {
  HOUR_HEIGHT,
  MIN_EVENT_HEIGHT,
  TIMELINE_HEIGHT,
  computeHourLineTop,
  computeTimelineScale,
} from '../../timeline-layout';
import type { TwoDayViewModel } from '../../two-day-view-model';
import { CalendarPeriodToolbar } from '../calendar-period-toolbar';
import { CalendarViewSwitcher } from '../calendar-view-switcher';
import { TwoDayView } from '../two-day-view';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-linear-gradient', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { LinearGradient: (props: React.ComponentProps<typeof View>) => React.createElement(View, props) };
});

const timelineItem = {
  id: 'event-1', title: '歯医者', temporalLabel: '14:30・30分',
  accessibilityLabel: '歯医者、14:30・30分', startMinute: 870, endMinute: 900,
  top: 812, height: 36, overlapIndex: 0, overlapCount: 1,
  opacityStops: [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }],
  isInstant: false, continuesFromPreviousDay: false, continuesToNextDay: false,
} as const;

const allDayItem = {
  id: 'all-day-event',
  title: '休暇',
  temporalLabel: '終日',
  accessibilityLabel: '休暇、終日',
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

function renderTwoDayView(overrides: Partial<{
  strip: readonly TwoDayViewModel[];
  bufferDays: number;
  columnWidth: number;
  now: () => Date;
  onEditEvent(id: string): void;
  onCreateExactAt(date: string, startTime: string): void;
}> = {}) {
  return render(
    <TwoDayView
      strip={overrides.strip ?? strip}
      bufferDays={overrides.bufferDays ?? BUFFER_DAYS}
      columnWidth={overrides.columnWidth ?? COLUMN_WIDTH}
      translateX={new Animated.Value(-(overrides.bufferDays ?? BUFFER_DAYS) * (overrides.columnWidth ?? COLUMN_WIDTH))}
      panHandlers={{}}
      onCarouselLayout={jest.fn()}
      onEditEvent={overrides.onEditEvent}
      onCreateExactAt={overrides.onCreateExactAt}
      now={overrides.now}
    />,
  );
}

describe('2日カレンダー表示コンポーネント', () => {
  it('予備列を含む全列を横並びで描画し、共通24時間軸・予定・空状態・祝日未対応を示す', async () => {
    const view = await renderTwoDayView();
    expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.summary').props.style)).toMatchObject({
      flexDirection: 'row',
    });
    expect(view.getAllByTestId('two-day-calendar.column')).toHaveLength(strip.length);
    expect(view.getByTestId('two-day-calendar.timeline')).toBeOnTheScreen();
    expect(view.getByText('0:00')).toBeOnTheScreen();
    expect(view.getByText('21:00')).toBeOnTheScreen();
    expect(view.getByText('24:00')).toBeOnTheScreen();
    expect(view.getByLabelText('歯医者、14:30・30分')).toBeOnTheScreen();
    // 予備列(前日・翌々日)もday2と同じく予定なしのため、3列分表示される。
    expect(view.getAllByText('予定はありません')).toHaveLength(3);
    expect(view.getByText('祝日情報未対応')).toBeOnTheScreen();
  });

  it('タイムライン上の予定をタップすると編集対象のIDを渡す', async () => {
    const onEditEvent = jest.fn();
    const view = await renderTwoDayView({ onEditEvent });

    fireEvent.press(view.getByLabelText('歯医者、14:30・30分'));

    expect(onEditEvent).toHaveBeenCalledWith('event-1');
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
        panHandlers={{}} onCarouselLayout={jest.fn()} />,
    );

    const stripStyle = StyleSheet.flatten(view.getByTestId('two-day-calendar.summary-strip').props.style);
    expect(stripStyle.width).toBe(strip.length * COLUMN_WIDTH);
    expect(stripStyle.transform[0].translateX).toBeDefined();
  });

  it('時間軸(48pt)を除いた、実際に日付列が占める幅をカルーセルへ通知する', async () => {
    const onCarouselLayout = jest.fn();
    const view = await render(
      <TwoDayView strip={strip} bufferDays={BUFFER_DAYS} columnWidth={COLUMN_WIDTH}
        translateX={new Animated.Value(-195)} panHandlers={{}} onCarouselLayout={onCarouselLayout}
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
    const panHandlers = { onStartShouldSetResponder: () => true };
    const view = await render(
      <TwoDayView strip={strip} bufferDays={BUFFER_DAYS} columnWidth={COLUMN_WIDTH}
        translateX={new Animated.Value(-195)} panHandlers={panHandlers} onCarouselLayout={jest.fn()}
        />,
    );

    expect(view.getByTestId('two-day-calendar').props.onStartShouldSetResponder).toBeDefined();
  });

  it('位置・重複幅と4種類のグラデーションstopを描画へ渡す', async () => {
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
      const gradient = view.getByTestId(`timeline-event.${item.id}.gradient`, { includeHiddenElements: true });
      expect(gradient.props.locations).toEqual(item.opacityStops.map((stop) => stop.offset));
      expect(gradient.props.colors).toHaveLength(item.opacityStops.length);
    });
  });

  it('予定テキストを不透明度が最も濃い部分へ寄せて配置する', async () => {
    const anchorPatterns = [
      { opacityStops: [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 0 }], expected: 'flex-start' },
      { opacityStops: [{ offset: 0, opacity: 0 }, { offset: 1, opacity: 1 }], expected: 'flex-end' },
      { opacityStops: [{ offset: 0, opacity: 1 }, { offset: 1, opacity: 1 }], expected: 'center' },
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
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: TIMELINE_HEIGHT / 2 } },
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

  it('24:00のラベルは軸の下端からはみ出さないよう、行の高さ分だけ上げて配置する', async () => {
    const view = await renderTwoDayView();

    // 行の高さ(13)分だけ上げて下端(TIMELINE_HEIGHT)に揃え、はみ出さないようにする。
    expect(StyleSheet.flatten(view.getByText('24:00').props.style)).toMatchObject({
      top: TIMELINE_HEIGHT - 13,
    });
  });

  it('罫線はすべて同じ太さにし、1時間ごとに物理ピクセルへ吸着した位置へ配置する', async () => {
    const view = await renderTwoDayView();

    // 1時間 = 21.5pt となり、ptのままでは1本おきに半ピクセル境界へ落ちる高さ。
    await fireEvent(view.getByTestId('two-day-calendar.timeline'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 516 } },
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
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 516 } },
    });
    const columnHeight = TIMELINE_HEIGHT * computeTimelineScale(516);

    // 24:00の線はtopが列の高さと同じになり、overflow:'hidden'で全体が消える。
    const lastLine = view.getAllByTestId('two-day-calendar.hour-line').slice(0, 25)[24];
    const style = StyleSheet.flatten(lastLine.props.style);
    expect(style.top + style.height).toBeLessThanOrEqual(columnHeight);
    // 内側へ寄せた後も物理ピクセルに揃い、薄れて見えないようにする。
    expect(PixelRatio.roundToNearestPixel(style.top)).toBe(style.top);
  });

  it('罫線を予定ブロックより手前に描画し、予定と重なる時間帯でも罫線が見えるようにする', async () => {
    const view = await renderTwoDayView();

    const hourLineZIndex = StyleSheet.flatten(
      view.getAllByTestId('two-day-calendar.hour-line')[0].props.style,
    ).zIndex;
    const eventZIndex = StyleSheet.flatten(
      view.getByTestId('timeline-event.event-1').props.style,
    ).zIndex;
    expect(hourLineZIndex).toBeGreaterThan(eventZIndex);
    // 罫線は表示のみが目的で、下にある予定へのタップ操作を妨げてはならない。
    expect(view.getAllByTestId('two-day-calendar.hour-line')[0].props.pointerEvents).toBe('none');
  });

  it('表示中の2日に今日を含む列にだけ現在時刻の赤線を引き、時間軸に現在時刻を表示する', async () => {
    const view = await renderTwoDayView({ now: () => new Date(2026, 8, 8, 14, 30) });

    expect(view.getByText('14:30')).toBeOnTheScreen();
    const nowLines = view.getAllByTestId('two-day-calendar.now-line');
    expect(nowLines).toHaveLength(1);
    expect(StyleSheet.flatten(nowLines[0].props.style)).toMatchObject({ top: 870 * (HOUR_HEIGHT / 60) });
  });

  it('23時台後半でも現在時刻線が下端で切れないよう、線の太さ分だけ内側へ収める', async () => {
    const view = await renderTwoDayView({ now: () => new Date(2026, 8, 8, 23, 59) });

    const style = StyleSheet.flatten(view.getAllByTestId('two-day-calendar.now-line')[0].props.style);
    expect(style.top + style.height).toBeLessThanOrEqual(TIMELINE_HEIGHT);
  });

  it('表示中の2日がどちらも今日でなければ現在時刻を表示しない', async () => {
    const notToday = [prevBuffer, { ...day1, isToday: false }, day2, nextBuffer];
    const view = await renderTwoDayView({ strip: notToday, now: () => new Date(2026, 8, 8, 14, 30) });

    expect(view.queryByText('14:30')).toBeNull();
    expect(view.queryByTestId('two-day-calendar.now-line')).toBeNull();
  });

  it('予備列が今日でも、表示中の2日でなければ時間軸のラベルは表示しないが、その列自体の線は表示する', async () => {
    const bufferIsToday = [{ ...prevBuffer, isToday: true }, { ...day1, isToday: false }, day2, nextBuffer];
    const view = await renderTwoDayView({ strip: bufferIsToday, now: () => new Date(2026, 8, 8, 14, 30) });

    expect(view.queryByText('14:30')).toBeNull();
    expect(view.getAllByTestId('two-day-calendar.now-line')).toHaveLength(1);
  });

  it('予定ブロックに枠線を描画しない', async () => {
    const view = await renderTwoDayView();

    const card = view.getByTestId('timeline-event.event-1.card');
    expect(StyleSheet.flatten(card.props.style).borderWidth).toBeFalsy();
  });

  it('小さい時間ラベルを予定背景上で読める本文色にする', async () => {
    const view = await renderTwoDayView();

    expect(StyleSheet.flatten(view.getByText('14:30・30分').props.style)).toMatchObject({
      color: Colors.light.text,
    });
  });

  it('2日ビュー上部には予定追加ボタンを表示しない', async () => {
    const view = await renderTwoDayView();
    expect(view.queryByText('＋ 予定')).toBeNull();
  });

  it('2日と月の選択状態を切り替えられる', async () => {
    const onSelectMode = jest.fn();
    const user = userEvent.setup();
    const view = await render(<CalendarViewSwitcher mode="twoDay" onSelectMode={onSelectMode} />);
    expect(view.getByRole('tab', { name: '2日表示' }).props.accessibilityState).toEqual({ selected: true });
    await user.press(view.getByRole('tab', { name: '月表示' }));
    expect(onSelectMode).toHaveBeenCalledWith('month');
  });

  it('期間ツールバーの操作領域を44pt以上にして前後・今日を実行する', async () => {
    const onPrevious = jest.fn();
    const onToday = jest.fn();
    const onNext = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <CalendarPeriodToolbar periodLabel="2026年9月8日〜9日" previousAccessibilityLabel="前の1日へ"
        nextAccessibilityLabel="次の1日へ" isLoading={false} onPrevious={onPrevious}
        onToday={onToday} onNext={onNext} />,
    );
    expect(StyleSheet.flatten(view.getByRole('button', { name: '前の1日へ' }).props.style)).toMatchObject({
      minHeight: 44, minWidth: 44,
    });
    await user.press(view.getByRole('button', { name: '前の1日へ' }));
    await user.press(view.getByRole('button', { name: '今日' }));
    await user.press(view.getByRole('button', { name: '次の1日へ' }));
    expect([onPrevious.mock.calls.length, onToday.mock.calls.length, onNext.mock.calls.length]).toEqual([1, 1, 1]);
  });

  it('読み込み中も次期間ボタンを維持して無効化する', async () => {
    const view = await render(
      <CalendarPeriodToolbar periodLabel="2026年9月8日〜9日" previousAccessibilityLabel="前の1日へ"
        nextAccessibilityLabel="次の1日へ" isLoading onPrevious={jest.fn()}
        onToday={jest.fn()} onNext={jest.fn()} />,
    );

    const nextButton = view.getByRole('button', { name: '次の1日へ' });
    expect(nextButton.props.accessibilityState).toEqual({ disabled: true });
    expect(view.getByTestId('calendar-period.loading')).toBeOnTheScreen();
  });
});

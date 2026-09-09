import { fireEvent, render, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import { HOUR_HEIGHT, TIMELINE_HEIGHT } from '../../timeline-layout';
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

const days: readonly [TwoDayViewModel, TwoDayViewModel] = [
  {
    date: '2026-09-08', dateLabel: '9月8日', weekdayLabel: '火', isToday: true,
    holidayName: null, holidaySupport: 'available',
    allDayItems: [], timelineItems: [timelineItem],
    accessibilityLabel: '2026年9月8日、火曜日、今日、予定1件',
  },
  {
    date: '2026-09-09', dateLabel: '9月9日', weekdayLabel: '水', isToday: false,
    holidayName: null, holidaySupport: 'unsupported', allDayItems: [], timelineItems: [],
    accessibilityLabel: '2026年9月9日、水曜日、祝日情報未対応、予定なし',
  },
];

describe('2日カレンダー表示コンポーネント', () => {
  it('2日を横2列と共通24時間軸で表示し、予定・空状態・祝日未対応を示す', async () => {
    const view = await render(<TwoDayView days={days} onAddEvent={jest.fn()} />);
    expect(StyleSheet.flatten(view.getByTestId('two-day-calendar.summary').props.style)).toMatchObject({
      flexDirection: 'row',
    });
    expect(view.getAllByTestId('two-day-calendar.column')).toHaveLength(2);
    expect(view.getByTestId('two-day-calendar.timeline')).toBeOnTheScreen();
    expect(view.getByText('0:00')).toBeOnTheScreen();
    expect(view.getByText('21:00')).toBeOnTheScreen();
    expect(view.getByLabelText('歯医者、14:30・30分')).toBeOnTheScreen();
    expect(view.getByText('予定はありません')).toBeOnTheScreen();
    expect(view.getByText('祝日情報未対応')).toBeOnTheScreen();
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
    const view = await render(<TwoDayView
      days={[{ ...days[0], timelineItems: gradientItems }, days[1]]}
      onAddEvent={jest.fn()}
    />);

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
    const view = await render(
      <TwoDayView days={[{ ...days[0], timelineItems: items }, days[1]]} onAddEvent={jest.fn()} />,
    );

    anchorPatterns.forEach(({ expected }, index) => {
      const textContainer = view.getByTestId(`timeline-event.anchor-${index}.text`);
      expect(StyleSheet.flatten(textContainer.props.style)).toMatchObject({ justifyContent: expected });
    });
  });

  it('計測した画面高さに合わせて24時間軸・時間線・予定の位置と高さを縮小する', async () => {
    const view = await render(<TwoDayView days={days} onAddEvent={jest.fn()} />);

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

  it('今日を含む列にだけ現在時刻の赤線を引き、時間軸に現在時刻を表示する', async () => {
    const view = await render(
      <TwoDayView days={days} onAddEvent={jest.fn()} now={() => new Date(2026, 8, 8, 14, 30)} />,
    );

    expect(view.getByText('14:30')).toBeOnTheScreen();
    const nowLines = view.getAllByTestId('two-day-calendar.now-line');
    expect(nowLines).toHaveLength(1);
    expect(StyleSheet.flatten(nowLines[0].props.style)).toMatchObject({ top: 870 * (HOUR_HEIGHT / 60) });
  });

  it('表示中の2日がどちらも今日でなければ現在時刻を表示しない', async () => {
    const notToday: readonly [TwoDayViewModel, TwoDayViewModel] = [
      { ...days[0], isToday: false },
      days[1],
    ];
    const view = await render(
      <TwoDayView days={notToday} onAddEvent={jest.fn()} now={() => new Date(2026, 8, 8, 14, 30)} />,
    );

    expect(view.queryByText('14:30')).toBeNull();
    expect(view.queryByTestId('two-day-calendar.now-line')).toBeNull();
  });

  it('予定ブロックに枠線を描画しない', async () => {
    const view = await render(<TwoDayView days={days} onAddEvent={jest.fn()} />);

    const card = view.getByTestId('timeline-event.event-1.card');
    expect(StyleSheet.flatten(card.props.style).borderWidth).toBeFalsy();
  });

  it('小さい時間ラベルを予定背景上で読める本文色にする', async () => {
    const view = await render(<TwoDayView days={days} onAddEvent={jest.fn()} />);

    expect(StyleSheet.flatten(view.getByText('14:30・30分').props.style)).toMatchObject({
      color: Colors.light.text,
    });
  });

  it('選んだ日付を予定追加へ渡す', async () => {
    const onAddEvent = jest.fn();
    const user = userEvent.setup();
    const view = await render(<TwoDayView days={days} onAddEvent={onAddEvent} />);
    await user.press(view.getByRole('button', { name: '9月9日に予定を追加' }));
    expect(onAddEvent).toHaveBeenCalledWith('2026-09-09');
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

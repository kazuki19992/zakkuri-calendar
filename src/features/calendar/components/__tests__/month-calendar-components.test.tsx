import { render, userEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { AgendaItemViewModel, MonthDayViewModel } from '../../month-view-model';
import { Colors } from '@/constants/theme';
import { CalendarLoadState } from '../calendar-load-state';
import { MonthDayCell } from '../month-day-cell';
import { MonthGrid } from '../month-grid';
import { MonthToolbar } from '../month-toolbar';
import { SelectedDayAgenda } from '../selected-day-agenda';

jest.mock('@/global.css', () => ({}));

function createDays(): readonly MonthDayViewModel[] {
  const start = new Date(Date.UTC(2026, 7, 31));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const calendarDate = date.toISOString().slice(0, 10);
    const isHoliday = calendarDate === '2026-09-21';

    return {
      date: calendarDate,
      dayNumber: date.getUTCDate(),
      weekday: date.getUTCDay(),
      isCurrentMonth: date.getUTCMonth() === 8,
      isToday: calendarDate === '2026-09-08',
      isSelected: calendarDate === '2026-09-21',
      hasEvents: calendarDate === '2026-09-21',
      holidayName: isHoliday ? '敬老の日' : null,
      accessibilityLabel: isHoliday
        ? '2026年9月21日、敬老の日、選択中、予定あり'
        : `2026年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`,
    };
  });
}

function createGestureEvents(dx: number, dy: number, duration: number) {
  const startPageX = 120;
  const startPageY = 120;
  const startEvent = {
    nativeEvent: { touches: [{ pageX: startPageX, pageY: startPageY }], timestamp: 0 },
    touchHistory: {
      touchBank: [
        {
          touchActive: true,
          startPageX,
          startPageY,
          previousPageX: startPageX,
          previousPageY: startPageY,
          currentPageX: startPageX,
          currentPageY: startPageY,
          currentTimeStamp: 0,
        },
      ],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: 0,
    },
  };
  const moveEvent = {
    nativeEvent: {
      touches: [{ pageX: startPageX + dx, pageY: startPageY + dy }],
      timestamp: duration,
    },
    touchHistory: {
      touchBank: [
        {
          touchActive: true,
          startPageX,
          startPageY,
          previousPageX: startPageX,
          previousPageY: startPageY,
          currentPageX: startPageX + dx,
          currentPageY: startPageY + dy,
          currentTimeStamp: duration,
        },
      ],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: duration,
    },
  };
  return { startEvent, moveEvent };
}

const agendaItems: readonly AgendaItemViewModel[] = [
  {
    id: 'event-1',
    title: '敬老会',
    temporalLabel: '終日',
    accessibilityLabel: '敬老会、終日',
  },
];

describe('月カレンダー表示コンポーネント', () => {
  it('月曜日始まりの六週間グリッドで日付を選択できる', async () => {
    const onSelectDate = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <MonthGrid
        visibleMonth="2026-09-01"
        days={createDays()}
        onSelectDate={onSelectDate}
        onPreviousMonth={jest.fn()}
        onToday={jest.fn()}
        onNextMonth={jest.fn()}
      />,
    );

    const buttons = view.getAllByRole('button');
    expect(buttons).toHaveLength(45);
    expect(buttons[3]).toHaveAccessibleName('2026年8月31日');
    await user.press(view.getByLabelText('2026年9月21日、敬老の日、選択中、予定あり'));

    expect(onSelectDate).toHaveBeenCalledWith('2026-09-21');
  });

  it('祝日名と選択状態を日付ボタンの読み上げ情報として提供する', async () => {
    const day = createDays().find((item) => item.date === '2026-09-21');
    if (day === undefined) throw new Error('テスト用の日付がありません');

    const view = await render(<MonthDayCell day={day} onPress={jest.fn()} />);

    const button = view.getByRole('button');
    expect(button).toHaveAccessibleName('2026年9月21日、敬老の日、選択中、予定あり');
    expect(button.props.accessibilityState).toEqual({ selected: true });
  });

  it('今日かつ選択中で予定がある日も枠と予定印を対比色で表示する', async () => {
    const baseDay = createDays().find((item) => item.date === '2026-09-21');
    if (baseDay === undefined) throw new Error('テスト用の日付がありません');
    const day = {
      ...baseDay,
      isToday: true,
      accessibilityLabel: '2026年9月21日、敬老の日、今日、選択中、予定あり',
    };
    const view = await render(<MonthDayCell day={day} onPress={jest.fn()} />);

    expect(StyleSheet.flatten(view.getByRole('button').props.style)).toMatchObject({
      backgroundColor: Colors.light.calendarAccent,
      borderColor: Colors.light.background,
    });
    const dotStyle = StyleSheet.flatten(
      view.getByTestId('month-calendar.event-dot.2026-09-21', {
        includeHiddenElements: true,
      }).props.style,
    );
    expect(dotStyle).toMatchObject({ backgroundColor: Colors.light.background });
    expect(dotStyle).not.toHaveProperty('opacity');
  });

  it('日付セルの押下領域を縦横ともに44pt以上にする', async () => {
    const day = createDays().find((item) => item.date === '2026-09-21');
    if (day === undefined) throw new Error('テスト用の日付がありません');
    const view = await render(<MonthDayCell day={day} onPress={jest.fn()} />);
    const button = view.getByRole('button');

    expect(button.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ minHeight: 44, minWidth: 44 })]),
    );
  });

  it('前月と今日と次月の操作をツールバーから実行する', async () => {
    const onPreviousMonth = jest.fn();
    const onToday = jest.fn();
    const onNextMonth = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <MonthToolbar
        visibleMonth="2026-09-01"
        onPreviousMonth={onPreviousMonth}
        onToday={onToday}
        onNextMonth={onNextMonth}
      />,
    );

    expect(view.getByRole('header')).toHaveTextContent('2026年9月');
    await user.press(view.getByRole('button', { name: '前月' }));
    await user.press(view.getByRole('button', { name: '今日' }));
    await user.press(view.getByRole('button', { name: '次月' }));

    expect(onPreviousMonth).toHaveBeenCalledTimes(1);
    expect(onToday).toHaveBeenCalledTimes(1);
    expect(onNextMonth).toHaveBeenCalledTimes(1);
  });

  it('カスタムヘッダーに月曜日から日曜日までの見出しを順に表示する', async () => {
    const view = await render(
      <MonthToolbar
        visibleMonth="2026-09-01"
        onPreviousMonth={jest.fn()}
        onToday={jest.fn()}
        onNextMonth={jest.fn()}
      />,
    );

    expect(
      view.getAllByTestId('month-calendar.weekday').map((weekday) => weekday.props.children),
    ).toEqual(['月', '火', '水', '木', '金', '土', '日']);
  });

  it('カスタムヘッダーの月移動操作を次月コールバックへ直接渡す', async () => {
    const onNextMonth = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <MonthGrid
        visibleMonth="2026-09-01"
        days={createDays()}
        onSelectDate={jest.fn()}
        onPreviousMonth={jest.fn()}
        onToday={jest.fn()}
        onNextMonth={onNextMonth}
      />,
    );

    await user.press(view.getByRole('button', { name: '次月' }));

    await waitFor(() => {
      expect(onNextMonth).toHaveBeenCalledTimes(1);
    });
  });

  it('左スワイプで次月コールバックを直接実行する', async () => {
    const onNextMonth = jest.fn();
    const view = await render(
      <MonthGrid
        visibleMonth="2026-09-01"
        days={createDays()}
        onSelectDate={jest.fn()}
        onPreviousMonth={jest.fn()}
        onToday={jest.fn()}
        onNextMonth={onNextMonth}
      />,
    );
    const swipeContainer = view.getByTestId('month-calendar.swipe');
    const { startEvent, moveEvent } = createGestureEvents(-100, 8, 100);

    swipeContainer.props.onStartShouldSetResponderCapture(startEvent);
    swipeContainer.props.onMoveShouldSetResponderCapture(moveEvent);
    swipeContainer.props.onResponderRelease(moveEvent);

    await waitFor(() => expect(onNextMonth).toHaveBeenCalledTimes(1));
  });

  it('右スワイプで前月コールバックを直接実行する', async () => {
    const onPreviousMonth = jest.fn();
    const view = await render(
      <MonthGrid
        visibleMonth="2026-09-01"
        days={createDays()}
        onSelectDate={jest.fn()}
        onPreviousMonth={onPreviousMonth}
        onToday={jest.fn()}
        onNextMonth={jest.fn()}
      />,
    );
    const swipeContainer = view.getByTestId('month-calendar.swipe');
    const { startEvent, moveEvent } = createGestureEvents(100, 8, 100);

    swipeContainer.props.onStartShouldSetResponderCapture(startEvent);
    swipeContainer.props.onMoveShouldSetResponderCapture(moveEvent);
    swipeContainer.props.onResponderRelease(moveEvent);

    await waitFor(() => expect(onPreviousMonth).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['縦方向', 8, 100, 100],
    ['短距離', 20, 0, 100],
    ['低速', 100, 0, 1000],
  ])('%sのジェスチャーでは月を移動しない', async (_kind, dx, dy, duration) => {
    const onPreviousMonth = jest.fn();
    const onNextMonth = jest.fn();
    const view = await render(
      <MonthGrid
        visibleMonth="2026-09-01"
        days={createDays()}
        onSelectDate={jest.fn()}
        onPreviousMonth={onPreviousMonth}
        onToday={jest.fn()}
        onNextMonth={onNextMonth}
      />,
    );
    const swipeContainer = view.getByTestId('month-calendar.swipe');
    const { startEvent, moveEvent } = createGestureEvents(dx, dy, duration);

    swipeContainer.props.onStartShouldSetResponderCapture(startEvent);
    swipeContainer.props.onMoveShouldSetResponderCapture(moveEvent);
    swipeContainer.props.onResponderRelease(moveEvent);

    expect(onPreviousMonth).not.toHaveBeenCalled();
    expect(onNextMonth).not.toHaveBeenCalled();
  });

  it('祝日情報が未対応でも選択日の予定と空状態を表示する', async () => {
    const view = await render(
      <SelectedDayAgenda
        selectedDate="2026-09-21"
        holidayName={null}
        holidaySupport="unsupported"
        items={agendaItems}
      />,
    );

    expect(view.getByText('祝日情報未対応')).toBeOnTheScreen();
    expect(view.getByLabelText('敬老会、終日')).toBeOnTheScreen();

    await view.rerender(
      <SelectedDayAgenda
        selectedDate="2026-09-22"
        holidayName={null}
        holidaySupport="available"
        items={[]}
      />,
    );

    expect(view.getByText('予定はありません')).toBeOnTheScreen();
  });

  it('読み込み失敗から再試行できる', async () => {
    const onRetry = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <CalendarLoadState status="error" onRetry={onRetry}>
        <MonthToolbar
          visibleMonth="2026-09-01"
          onPreviousMonth={jest.fn()}
          onToday={jest.fn()}
          onNextMonth={jest.fn()}
        />
      </CalendarLoadState>,
    );

    expect(view.getByText('データを読み込めませんでした')).toBeOnTheScreen();
    await user.press(view.getByRole('button', { name: '再試行' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

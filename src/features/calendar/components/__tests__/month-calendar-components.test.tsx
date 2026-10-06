import { render, userEvent } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { Colors } from '@/constants/theme';
import type { MonthDayViewModel, MonthWeekViewModel } from '../../month-view-model';
import { CalendarLoadState } from '../calendar-load-state';
import { MonthDayCell } from '../month-day-cell';
import { MonthGrid } from '../month-grid';
import { SelectedDayAgenda } from '../selected-day-agenda';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({
  // Link Preview is iOS only. The unit test verifies the cell action independently.
  Link: Object.assign(({ children }: { children: ReactNode }) => children, {
    Trigger: ({ children }: { children: ReactNode }) => children,
    Preview: () => null,
  }),
}));

function createDays(): readonly MonthDayViewModel[] {
  const start = new Date(Date.UTC(2026, 7, 31));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const value = date.toISOString().slice(0, 10);
    return {
      date: value,
      dayNumber: date.getUTCDate(),
      weekday: date.getUTCDay(),
      isCurrentMonth: date.getUTCMonth() === 8,
      isToday: value === '2026-09-08',
      isSelected: value === '2026-09-21',
      hasEvents: value === '2026-09-21',
      holidaySupport: 'available',
      holidayName: value === '2026-09-21' ? '敬老の日' : null,
      accessibilityLabel:
        value === '2026-09-21'
          ? '2026年9月21日、敬老の日、選択中、予定あり'
          : `2026年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`,
    };
  });
}

function createWeeks(days: readonly MonthDayViewModel[]): readonly MonthWeekViewModel[] {
  return Array.from({ length: 6 }, (_, weekIndex) => ({
    days: days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => ({ ...day, hiddenEventCount: day.date === '2026-09-21' ? 1 : 0 })),
    segments: weekIndex === 3 ? [{
      id: 'series-1:recurrence:2026-09-21', eventId: 'series-1', originalOccurrenceDate: '2026-09-21',
      weekIndex, lane: 0, startWeekday: 0, spanDays: 3, position: 'start' as const, startsInWeek: true, endsInWeek: true,
      continuesFromPreviousWeek: false, continuesToNextWeek: false, colorId: 'red' as const,
      title: '通院', temporalLabel: '10:00', accessibilityLabel: '通院、10:00、繰り返し予定',
    }] : [],
  }));
}

describe('独自月カレンダー表示', () => {
  it('日付数字と他N件は1日ビューを開き、予定blockは発生回を編集する', async () => {
    const days = createDays();
    const onOpenDay = jest.fn();
    const onEditEvent = jest.fn();
    const user = userEvent.setup();
    const platform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const view = await render(<MonthGrid days={days} weekModels={createWeeks(days)} onSelectDate={jest.fn()} onOpenDay={onOpenDay} onEditEvent={onEditEvent} />);

    await user.press(view.getByRole('button', { name: '2026年9月21日、敬老の日、選択中、予定ありを開く' }));
    await user.press(view.getByRole('button', { name: '他1件、2026年9月21日の予定を開く' }));
    await user.press(view.getByRole('button', { name: '通院、10:00、繰り返し予定' }));

    expect(onOpenDay).toHaveBeenNthCalledWith(1, '2026-09-21');
    expect(onOpenDay).toHaveBeenNthCalledWith(2, '2026-09-21');
    expect(onEditEvent).toHaveBeenCalledWith('series-1', '2026-09-21');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  });

  it('選択日の発生回をタップすると表示keyではなく元シリーズIDを渡す', async () => {
    const onEditEvent = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <SelectedDayAgenda
        selectedDate="2026-09-21"
        holidayName={null}
        holidaySupport="available"
        items={[{
          id: 'series-1:recurrence:2026-09-21',
          eventId: 'series-1',
          originalOccurrenceDate: '2026-09-21',
          title: '通院',
          temporalLabel: '10:00',
          accessibilityLabel: '通院、10:00、繰り返し予定',
        }]}
        onEditEvent={onEditEvent}
      />,
    );

    await user.press(view.getByRole('button', { name: '通院、10:00、繰り返し予定' }));

    expect(onEditEvent).toHaveBeenCalledWith('series-1', '2026-09-21');
  });

  it('月曜日から日曜日の見出しと7列6行の日付を表示して選択できる', async () => {
    const onSelectDate = jest.fn();
    const user = userEvent.setup();
    const view = await render(<MonthGrid days={createDays()} onSelectDate={onSelectDate} />);

    expect(view.getAllByTestId('month-calendar.weekday').map((item) => item.props.children)).toEqual([
      '月', '火', '水', '木', '金', '土', '日',
    ]);
    expect(view.getAllByTestId('month-calendar.week')).toHaveLength(6);
    expect(view.getAllByRole('button')).toHaveLength(42);
    await user.press(view.getByLabelText('2026年9月21日、敬老の日、選択中、予定あり'));
    expect(onSelectDate).toHaveBeenCalledWith('2026-09-21');
  });

  it('選択日を読み上げ状態と淡い背景で示し、操作領域を44pt以上にする', async () => {
    const day = createDays().find((item) => item.date === '2026-09-21');
    if (day === undefined) throw new Error('テスト用の日付がありません');
    const view = await render(<MonthDayCell day={day} onPress={jest.fn()} />);

    expect(view.getByRole('button').props.accessibilityState).toEqual({ selected: true });
    expect(StyleSheet.flatten(view.getByRole('button').props.style)).toMatchObject({
      minHeight: 44,
      minWidth: 44,
      backgroundColor: Colors.light.backgroundSelected,
    });
    expect(StyleSheet.flatten(view.getByRole('button').props.style).borderRadius).toBeUndefined();
  });

  it('今日の日付数字を円形アクセントで示す', async () => {
    const day = createDays().find((item) => item.date === '2026-09-08');
    if (day === undefined) throw new Error('テスト用の日付がありません');
    const view = await render(<MonthDayCell day={day} onPress={jest.fn()} />);

    expect(StyleSheet.flatten(view.getByTestId('month-calendar.day-circle.2026-09-08').props.style))
      .toMatchObject({
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: Colors.light.calendarAccent,
      });
    expect(StyleSheet.flatten(view.getByText('8').props.style).color).toBe(Colors.light.background);
  });

  it('相対予定を点ではなく破線の期間バーで示す', async () => {
    const baseDay = createDays().find((item) => item.date === '2026-09-21');
    if (baseDay === undefined) throw new Error('テスト用の日付がありません');
    const view = await render(<MonthDayCell day={{
      ...baseDay,
      hasFixedEvents: false,
      hasFuzzyRangeEvents: true,
    }} onPress={jest.fn()} />);

    expect(StyleSheet.flatten(view.getByTestId(
      'month-calendar.event-dot.2026-09-21',
      { includeHiddenElements: true },
    ).props.style).opacity)
      .toBe(0);
    const rangeBarStyle = StyleSheet.flatten(view.getByTestId(
      'month-calendar.fuzzy-range-bar.2026-09-21',
      { includeHiddenElements: true },
    ).props.style);
    expect(rangeBarStyle).toMatchObject({ borderStyle: 'dashed' });
    expect(rangeBarStyle.opacity).toBeUndefined();
  });

  it('選択日の相対予定を期間ラベル付きの破線項目で示す', async () => {
    const view = await render(<SelectedDayAgenda
      selectedDate="2026-09-21"
      holidayName={null}
      holidaySupport="available"
      items={[{
        kind: 'fuzzyRange', id: 'relative', eventId: 'relative', title: '今週やること',
        temporalLabel: '今週中・9月21日〜9月25日', rangeLabel: '9月21日〜9月25日',
        accessibilityLabel: '今週やること、今週中・9月21日〜9月25日、相対予定',
      }]}
    />);

    expect(StyleSheet.flatten(view.getByTestId('selected-day-agenda.fuzzy-range.relative').props.style))
      .toMatchObject({ borderStyle: 'dashed' });
    expect(view.getByText('今週中・9月21日〜9月25日')).toBeOnTheScreen();
  });

  it('読み込み失敗から再試行できる', async () => {
    const onRetry = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <CalendarLoadState status="error" onRetry={onRetry}>
        <MonthGrid days={createDays()} onSelectDate={jest.fn()} />
      </CalendarLoadState>,
    );

    await user.press(view.getByRole('button', { name: '再試行' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

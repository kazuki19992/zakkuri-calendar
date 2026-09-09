import { render, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import type { MonthDayViewModel } from '../../month-view-model';
import { CalendarLoadState } from '../calendar-load-state';
import { MonthDayCell } from '../month-day-cell';
import { MonthGrid } from '../month-grid';

jest.mock('@/global.css', () => ({}));

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

describe('独自月カレンダー表示', () => {
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

  it('選択日を色以外の下線でも示し、操作領域を44pt以上にする', async () => {
    const day = createDays().find((item) => item.date === '2026-09-21');
    if (day === undefined) throw new Error('テスト用の日付がありません');
    const view = await render(<MonthDayCell day={day} onPress={jest.fn()} />);

    expect(StyleSheet.flatten(view.getByText('21').props.style)).toMatchObject({
      textDecorationLine: 'underline',
    });
    expect(StyleSheet.flatten(view.getByRole('button').props.style)).toMatchObject({
      minHeight: 44,
      minWidth: 44,
      backgroundColor: Colors.light.backgroundSelected,
    });
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

import { render, userEvent } from '@testing-library/react-native';
import type { AgendaItemViewModel, MonthDayViewModel } from '../../month-view-model';
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

  it('祝日情報が未対応でも選択日の予定と空状態を表示する', async () => {
    const view = await render(
      <SelectedDayAgenda
        selectedDate="2026-09-21"
        holidayName={null}
        holidaySupport="unsupported"
        items={agendaItems}
      />,
    );

    expect(view.getByText('祝日情報を表示できません')).toBeOnTheScreen();
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

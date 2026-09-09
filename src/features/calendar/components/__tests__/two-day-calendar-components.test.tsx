import { render, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { TwoDayViewModel } from '../../two-day-view-model';
import { CalendarPeriodToolbar } from '../calendar-period-toolbar';
import { CalendarViewSwitcher } from '../calendar-view-switcher';
import { TwoDayView } from '../two-day-view';

jest.mock('@/global.css', () => ({}));

const days: readonly [TwoDayViewModel, TwoDayViewModel] = [
  {
    date: '2026-09-08', dateLabel: '9月8日', weekdayLabel: '火', isToday: true,
    holidayName: null, holidaySupport: 'available',
    items: [{ id: 'event-1', title: '歯医者', temporalLabel: '14:30', accessibilityLabel: '歯医者、14:30' }],
    accessibilityLabel: '2026年9月8日、火曜日、今日、予定1件',
  },
  {
    date: '2026-09-09', dateLabel: '9月9日', weekdayLabel: '水', isToday: false,
    holidayName: null, holidaySupport: 'unsupported', items: [],
    accessibilityLabel: '2026年9月9日、水曜日、祝日情報未対応、予定なし',
  },
];

describe('2日カレンダー表示コンポーネント', () => {
  it('2日を横2列で表示し、予定・空状態・祝日未対応を示す', async () => {
    const view = await render(<TwoDayView days={days} onAddEvent={jest.fn()} />);
    expect(StyleSheet.flatten(view.getByTestId('two-day-calendar').props.style)).toMatchObject({
      flexDirection: 'row',
    });
    expect(view.getAllByTestId('two-day-calendar.column')).toHaveLength(2);
    expect(view.getByLabelText('歯医者、14:30')).toBeOnTheScreen();
    expect(view.getByText('予定はありません')).toBeOnTheScreen();
    expect(view.getByText('祝日情報未対応')).toBeOnTheScreen();
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
    expect(view.getByRole('button', { name: '2日表示' }).props.accessibilityState).toEqual({ selected: true });
    await user.press(view.getByRole('button', { name: '月表示' }));
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
});

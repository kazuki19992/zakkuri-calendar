import { render, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { MonthDayViewModel } from '../../month-view-model';
import { CalendarDatePicker } from '../calendar-date-picker';
import { CalendarTopBar } from '../calendar-top-bar';
import { CalendarViewMenu } from '../calendar-view-menu';

jest.mock('@/global.css', () => ({}));

const days: readonly MonthDayViewModel[] = Array.from({ length: 42 }, (_, index) => ({
  date: `2026-09-${String(index + 1).padStart(2, '0')}`,
  dayNumber: index + 1,
  weekday: index % 7,
  isCurrentMonth: true,
  isToday: index === 7,
  isSelected: index === 23,
  hasEvents: index === 23,
  holidaySupport: 'available' as const,
  holidayName: null,
  accessibilityLabel: `2026年9月${index + 1}日`,
}));

describe('カレンダーのトップナビゲーション', () => {
  it('メニュー、月名、今日の各操作を44pt以上で表示する', async () => {
    const user = userEvent.setup();
    const onOpenMenu = jest.fn();
    const onToggleDatePicker = jest.fn();
    const onToday = jest.fn();
    const view = await render(
      <CalendarTopBar
        model={{ monthLabel: '9月', yearLabel: null, accessibilityLabel: '2026年9月、日付を選択' }}
        isLoading={false}
        onOpenMenu={onOpenMenu}
        onToggleDatePicker={onToggleDatePicker}
        onToday={onToday}
      />,
    );

    const menu = view.getByRole('button', { name: '表示メニューを開く' });
    const month = view.getByRole('button', { name: '2026年9月、日付を選択' });
    const today = view.getByRole('button', { name: '今日へ移動' });
    expect(menu.props.style).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
    expect(month.props.style).toEqual(expect.objectContaining({ minHeight: 44 }));
    expect(today.props.style).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
    await user.press(menu);
    await user.press(month);
    await user.press(today);
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(onToggleDatePicker).toHaveBeenCalledTimes(1);
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it('表示メニューは実在する2日と月だけを表示して選択できる', async () => {
    const user = userEvent.setup();
    const onSelectMode = jest.fn().mockResolvedValue(true);
    const onClose = jest.fn();
    const view = await render(
      <CalendarViewMenu visible mode="twoDay" onSelectMode={onSelectMode} onClose={onClose} />,
    );

    expect(view.getByText('表示')).toBeOnTheScreen();
    expect(view.getByRole('menuitem', { name: '2日表示' }).props.accessibilityState)
      .toMatchObject({ selected: true });
    expect(view.getByRole('menuitem', { name: '月表示' })).toBeOnTheScreen();
    expect(view.queryByText('3日')).toBeNull();
    await user.press(view.getByRole('menuitem', { name: '月表示' }));
    expect(onSelectMode).toHaveBeenCalledWith('month');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('日付ピッカーは月移動と日付選択を提供する', async () => {
    const user = userEvent.setup();
    const onPreviousMonth = jest.fn();
    const onNextMonth = jest.fn();
    const onSelectDate = jest.fn().mockResolvedValue(true);
    const onClose = jest.fn();
    const view = await render(
      <CalendarDatePicker
        visible
        month="2026-09-01"
        days={days}
        isLoading={false}
        error={null}
        topOffset={52}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        onSelectDate={onSelectDate}
        onClose={onClose}
      />,
    );

    expect(view.getByLabelText('日付を選択')).toBeOnTheScreen();
    expect(view.getByTestId('calendar-date-picker.panel').props.accessible).not.toBe(true);
    expect(view.getByText('2026年9月')).toBeOnTheScreen();
    expect(view.getAllByTestId('month-calendar.week')).toHaveLength(6);
    await user.press(view.getByRole('button', { name: '次の月' }));
    await user.press(view.getByLabelText('2026年9月24日'));
    expect(onNextMonth).toHaveBeenCalledTimes(1);
    expect(onSelectDate).toHaveBeenCalledWith('2026-09-24');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('日付移動に失敗した場合はピッカーを閉じずエラーを表示する', async () => {
    const user = userEvent.setup();
    const onSelectDate = jest.fn().mockResolvedValue(false);
    const onClose = jest.fn();
    const view = await render(
      <CalendarDatePicker
        visible month="2026-09-01" days={days} isLoading={false}
        error="月の予定を読み込めませんでした"
        topOffset={52}
        onPreviousMonth={jest.fn()} onNextMonth={jest.fn()}
        onSelectDate={onSelectDate} onClose={onClose}
      />,
    );

    expect(view.getByRole('alert')).toHaveTextContent('月の予定を読み込めませんでした');
    await user.press(view.getByLabelText('2026年9月24日'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('日付ピッカーは320pt幅でも7列の44ptタップ領域を保てる横幅を使う', async () => {
    const view = await render(
      <CalendarDatePicker
        visible month="2026-09-01" days={days} isLoading={false} error={null}
        topOffset={52}
        onPreviousMonth={jest.fn()} onNextMonth={jest.fn()}
        onSelectDate={jest.fn().mockResolvedValue(true)} onClose={jest.fn()}
      />,
    );

    expect(StyleSheet.flatten(view.getByTestId('calendar-date-picker.panel').props.style))
      .toMatchObject({ width: '100%', paddingHorizontal: 0 });
    expect(StyleSheet.flatten(view.getByTestId('calendar-date-picker.backdrop').props.style))
      .toMatchObject({ paddingHorizontal: 0 });
  });

  it('日付ピッカーはAndroidでステータスバーを含む座標系を使う', async () => {
    const view = await render(
      <CalendarDatePicker
        visible month="2026-09-01" days={days} isLoading={false} error={null}
        topOffset={52}
        onPreviousMonth={jest.fn()} onNextMonth={jest.fn()}
        onSelectDate={jest.fn().mockResolvedValue(true)} onClose={jest.fn()}
      />,
    );

    expect(view.getByTestId('calendar-date-picker.backdrop').parent?.type).toBe('Modal');
    expect(view.getByTestId('calendar-date-picker.backdrop').parent?.props.statusBarTranslucent).toBe(true);
  });
});

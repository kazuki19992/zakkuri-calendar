import { act, fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { MonthDayViewModel } from '../../month-view-model';
import { CalendarDatePicker } from '../calendar-date-picker';
import { CalendarTopBar } from '../calendar-top-bar';
import { CalendarSideMenu } from '../calendar-side-menu';

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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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
    expect(StyleSheet.flatten(today.props.style)).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
    expect(today).toHaveTextContent('今日');
    expect(view.queryByText('◎')).toBeNull();
    await user.press(menu);
    await user.press(month);
    await user.press(today);
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(onToggleDatePicker).toHaveBeenCalledTimes(1);
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it('サイドメニューは80%幅で実在する表示、カレンダー、設定だけを示す', async () => {
    const user = userEvent.setup();
    const onSelectMode = jest.fn().mockResolvedValue(true);
    const onClose = jest.fn();
    const view = await render(
      <CalendarSideMenu
        visible mode="twoDay" calendarName="マイカレンダー" calendarColorId="blue"
        isCalendarVisible isCalendarVisibilityUpdating={false} calendarVisibilityError={null}
        topInset={0} bottomInset={0}
        reduceMotion onSelectMode={onSelectMode}
        onSetCalendarVisible={jest.fn().mockResolvedValue(true)}
        onOpenSettings={jest.fn()} onClose={onClose}
      />,
    );

    expect(StyleSheet.flatten(view.getByTestId('calendar-side-menu.panel').props.style))
      .toMatchObject({ width: '80%', maxWidth: 360 });
    expect(view.getByRole('menuitem', { name: '2日表示' }).props.accessibilityState)
      .toMatchObject({ selected: true });
    expect(view.getByRole('menuitem', { name: '月表示' })).toBeOnTheScreen();
    expect(view.getByRole('switch', { name: 'マイカレンダーを表示' }).props.value).toBe(true);
    expect(view.getByLabelText('マイカレンダーの色、青')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: '設定を開く' })).toBeOnTheScreen();
    expect(view.queryByText('3日')).toBeNull();
    await user.press(view.getByRole('menuitem', { name: '月表示' }));
    expect(onSelectMode).toHaveBeenCalledWith('month');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('カレンダー表示の保存成功時は閉じ、失敗時はalertを残す', async () => {
    const onSetCalendarVisible = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const onClose = jest.fn();
    const { rerender, getByRole } = await render(
      <CalendarSideMenu
        visible mode="twoDay" calendarName="マイカレンダー" calendarColorId="blue"
        isCalendarVisible isCalendarVisibilityUpdating={false} calendarVisibilityError={null}
        topInset={0} bottomInset={0}
        reduceMotion onSelectMode={jest.fn().mockResolvedValue(true)}
        onSetCalendarVisible={onSetCalendarVisible}
        onOpenSettings={jest.fn()} onClose={onClose}
      />,
    );

    await act(async () => {
      fireEvent(getByRole('switch', { name: 'マイカレンダーを表示' }), 'valueChange', false);
      await Promise.resolve();
    });
    await waitFor(() => expect(onSetCalendarVisible).toHaveBeenCalledWith(false));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    await rerender(
      <CalendarSideMenu
        visible mode="twoDay" calendarName="マイカレンダー" calendarColorId="blue"
        isCalendarVisible isCalendarVisibilityUpdating={false}
        calendarVisibilityError="カレンダー表示設定を保存できませんでした"
        topInset={0} bottomInset={0}
        reduceMotion onSelectMode={jest.fn().mockResolvedValue(true)}
        onSetCalendarVisible={onSetCalendarVisible}
        onOpenSettings={jest.fn()} onClose={onClose}
      />,
    );
    expect(getByRole('alert')).toHaveTextContent('カレンダー表示設定を保存できませんでした');
  });

  it('背景、OS戻る、設定選択から閉じられる', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onOpenSettings = jest.fn();
    const view = await render(
      <CalendarSideMenu
        visible mode="twoDay" calendarName="マイカレンダー" calendarColorId="blue"
        isCalendarVisible isCalendarVisibilityUpdating={false} calendarVisibilityError={null}
        topInset={0} bottomInset={0}
        reduceMotion onSelectMode={jest.fn().mockResolvedValue(true)}
        onSetCalendarVisible={jest.fn().mockResolvedValue(true)}
        onOpenSettings={onOpenSettings} onClose={onClose}
      />,
    );

    fireEvent.press(view.getByTestId('calendar-side-menu.backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.getByTestId('calendar-side-menu.backdrop').parent?.props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.press(view.getByRole('button', { name: '設定を開く' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('閉じる前に開始した操作の完了で再表示後のメニューを閉じない', async () => {
    const user = userEvent.setup();
    const modeResult = createDeferred<boolean>();
    const visibilityResult = createDeferred<boolean>();
    const onSelectMode = jest.fn().mockReturnValue(modeResult.promise);
    const onSetCalendarVisible = jest.fn().mockReturnValue(visibilityResult.promise);
    const onClose = jest.fn();
    const props = {
      mode: 'twoDay' as const,
      calendarName: 'マイカレンダー',
      calendarColorId: 'blue' as const,
      isCalendarVisible: true,
      isCalendarVisibilityUpdating: false,
      calendarVisibilityError: null,
      topInset: 0,
      bottomInset: 0,
      reduceMotion: true,
      onSelectMode,
      onSetCalendarVisible,
      onOpenSettings: jest.fn(),
      onClose,
    };
    const view = await render(<CalendarSideMenu {...props} visible />);

    await user.press(view.getByRole('menuitem', { name: '月表示' }));
    await user.press(view.getByTestId('calendar-side-menu.backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => {
      modeResult.resolve(true);
      await modeResult.promise;
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.press(view.getByRole('switch', { name: 'マイカレンダーを表示' }));
    await user.press(view.getByTestId('calendar-side-menu.backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
    await act(async () => {
      visibilityResult.resolve(true);
      await visibilityResult.promise;
    });
    expect(onClose).toHaveBeenCalledTimes(2);
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

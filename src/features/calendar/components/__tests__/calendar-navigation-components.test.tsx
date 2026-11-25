import { CalendarAppearanceContext } from '@/hooks/calendar-appearance-context';
import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';
import { Animated, Platform, StyleSheet } from 'react-native';
import { CalendarDatePicker } from '../calendar-date-picker';
import { CalendarTopBar } from '../calendar-top-bar';
import { CalendarSideMenu } from '../calendar-side-menu';

jest.mock('@/global.css', () => ({}));

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
    expect(StyleSheet.flatten(menu.props.style)).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
    expect(StyleSheet.flatten(month.props.style)).toEqual(expect.objectContaining({ minHeight: 44 }));
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

  it('年が現れると月名が下がり、年を隠すと月名が元の高さに戻る', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const makeBar = (yearLabel: string | null) => (
      <CalendarTopBar model={{ monthLabel: '9月', yearLabel, accessibilityLabel: '2026年9月' }}
        isLoading={false} onOpenMenu={jest.fn()} onToggleDatePicker={jest.fn()} onToday={jest.fn()} />
    );
    try {
      const view = await render(makeBar(null));
      await view.rerender(makeBar('2026年'));
      const year = view.getByText('2026年', { includeHiddenElements: true });
      await fireEvent(year, 'layout', { nativeEvent: { layout: { height: 14 } } });
      const yearRow = () => StyleSheet.flatten(view.getByTestId('calendar.top-bar.year-row', { includeHiddenElements: true }).props.style);
      expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 1 }));
      await waitFor(() => expect(yearRow()).toMatchObject({ height: 14, opacity: 1 }));
      await view.rerender(makeBar(null));
      expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0 }));
      await waitFor(() => expect(view.queryByText('2026年', { includeHiddenElements: true })).toBeNull());
      expect(yearRow()).toMatchObject({ height: 0, opacity: 0 });
    } finally {
      timing.mockRestore();
    }
  });

  it('サイドメニューは表示切替を重複させず、カレンダーと設定を表示する', async () => {
    const view = await render(
      <CalendarSideMenu visible calendarName="マイカレンダー" calendarColorId="blue"
        isCalendarVisible isCalendarVisibilityUpdating={false} calendarVisibilityError={null}
        reduceMotion onSetCalendarVisible={jest.fn().mockResolvedValue(true)}
        onOpenSettings={jest.fn()} onClose={jest.fn()} />,
    );
    expect(view.queryByRole('menuitem', { name: '月表示' })).toBeNull();
    expect(view.getByTestId('calendar-side-menu.visibility-switch')).toHaveProp('label', 'マイカレンダーを表示');
    expect(view.getByRole('button', { name: '設定を開く' })).toBeOnTheScreen();
  });

  it('iOSではカレンダー表示スイッチの描画サイズを行中央の配置に使う', async () => {
    const view = await render(
      <CalendarSideMenu visible calendarName="マイカレンダー" calendarColorId="blue"
        isCalendarVisible isCalendarVisibilityUpdating={false} calendarVisibilityError={null}
        reduceMotion onSetCalendarVisible={jest.fn().mockResolvedValue(true)}
        onOpenSettings={jest.fn()} onClose={jest.fn()} />,
    );
    const host = view.getByTestId('calendar-side-menu.visibility-switch-host');
    expect(host).toHaveProp('matchContentsVertical', true);
    expect(host).toHaveProp('matchContentsHorizontal', true);
  });

  it('Androidでもカレンダー名を読み上げるスイッチで表示を切り替える', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const onSetCalendarVisible = jest.fn().mockResolvedValue(true);
      const view = await render(
        <CalendarSideMenu visible calendarName="マイカレンダー" calendarColorId="blue"
          isCalendarVisible isCalendarVisibilityUpdating={false} calendarVisibilityError={null}
          reduceMotion onSetCalendarVisible={onSetCalendarVisible}
          onOpenSettings={jest.fn()} onClose={jest.fn()} />,
      );
      const visibilitySwitch = view.getByLabelText('マイカレンダーを表示');
      expect(visibilitySwitch).toHaveProp('accessibilityRole', 'switch');
      await fireEvent(visibilitySwitch, 'valueChange', false);
      expect(onSetCalendarVisible).toHaveBeenCalledWith(false);
    } finally {
      platform.restore();
    }
  });

  it.each([
    ['blue', 'ティール（初期色）', '#14665D'],
    ['purple', '紫', '#6A1B9A'],
  ] as const)('カレンダー色が%sのときに色見本とラベルを合わせる', async (colorId, label, backgroundColor) => {
    const view = await render(
      <CalendarSideMenu visible calendarName="マイカレンダー" calendarColorId={colorId}
        isCalendarVisible isCalendarVisibilityUpdating={false} calendarVisibilityError={null}
        reduceMotion onSetCalendarVisible={jest.fn().mockResolvedValue(true)}
        onOpenSettings={jest.fn()} onClose={jest.fn()} />,
    );
    expect(view.getByLabelText(`マイカレンダーの色、${label}`)).toHaveStyle({ backgroundColor });
  });

  it('初期ティールを先頭に表示し、明示色から元の色に戻せる', async () => {
    const setColor = jest.fn().mockResolvedValue(true);
    const view = await render(
      <CalendarAppearanceContext.Provider value={{ colorId: 'blue', isBusy: false, error: null, setColor }}>
        <CalendarSideMenu visible calendarName="マイカレンダー" calendarColorId="blue"
          isCalendarVisible isCalendarVisibilityUpdating={false} calendarVisibilityError={null}
          reduceMotion onSetCalendarVisible={jest.fn().mockResolvedValue(true)}
          onOpenSettings={jest.fn()} onClose={jest.fn()} />
      </CalendarAppearanceContext.Provider>,
    );
    await fireEvent.press(view.getByRole('button', { name: 'マイカレンダーの色、青' }));
    expect(view.getAllByRole('button').find((button) => ['ティール（初期色）', '青'].includes(button.props.accessibilityLabel)))
      .toHaveAccessibleName('ティール（初期色）');
    for (const label of ['ティール（初期色）', '青、選択中', '青緑', '緑', '黄土', '橙', '赤', '紫', '灰']) {
      expect(view.getByRole('button', { name: label })).toBeOnTheScreen();
    }
    await fireEvent.press(view.getByRole('button', { name: 'ティール（初期色）' }));
    expect(setColor).toHaveBeenCalledWith('default-teal');
  });

  it('カレンダー表示を切り替えても開いたままになり、保存失敗時はエラーを出す', async () => {
    const onSetCalendarVisible = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const onClose = jest.fn();
    const { rerender, getByRole, getByTestId } = await render(
      <CalendarSideMenu
        visible calendarName="マイカレンダー" calendarColorId="blue"
        isCalendarVisible isCalendarVisibilityUpdating={false} calendarVisibilityError={null}
        reduceMotion
        onSetCalendarVisible={onSetCalendarVisible}
        onOpenSettings={jest.fn()} onClose={onClose}
      />,
    );

    await fireEvent(getByTestId('calendar-side-menu.visibility-switch'), 'isOnChange', { nativeEvent: { isOn: false } });
    await waitFor(() => expect(onSetCalendarVisible).toHaveBeenCalledWith(false));
    expect(onClose).not.toHaveBeenCalled();

    await rerender(
      <CalendarSideMenu
        visible calendarName="マイカレンダー" calendarColorId="blue"
        isCalendarVisible={false} isCalendarVisibilityUpdating={false}
        calendarVisibilityError="カレンダー表示設定を保存できませんでした"
        reduceMotion
        onSetCalendarVisible={onSetCalendarVisible}
        onOpenSettings={jest.fn()} onClose={onClose}
      />,
    );
    const visibilitySwitch = getByTestId('calendar-side-menu.visibility-switch');
    expect(visibilitySwitch).toHaveProp('isOn', false);
    await fireEvent(visibilitySwitch, 'isOnChange', { nativeEvent: { isOn: true } });
    expect(onSetCalendarVisible).toHaveBeenLastCalledWith(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(getByRole('alert')).toHaveTextContent('カレンダー表示設定を保存できませんでした');
  });

  it('背景、OS戻る、設定選択から閉じられる', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onOpenSettings = jest.fn();
    const view = await render(
      <CalendarSideMenu
        visible calendarName="マイカレンダー" calendarColorId="blue"
        isCalendarVisible isCalendarVisibilityUpdating={false} calendarVisibilityError={null}
        reduceMotion
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

  it('年月ピッカーでは年だけを先送りし、選んだ月の1日に移動する', async () => {
    const user = userEvent.setup();
    const onSelectDate = jest.fn().mockResolvedValue(true);
    const onClose = jest.fn();
    const view = await render(<CalendarDatePicker month="2026-09-01" topOffset={60}
      error={null} onSelectDate={onSelectDate} onClose={onClose} />);
    const september = view.getByRole('button', { name: '2026年9月' });
    const april = view.getByRole('button', { name: '2026年4月' });
    expect(september).toBeSelected();
    expect(september).toHaveStyle({ borderWidth: 1 });
    expect(april).not.toHaveStyle({ borderWidth: 1 });
    await user.press(view.getByRole('button', { name: '次の年' }));
    expect(onSelectDate).not.toHaveBeenCalled();
    await user.press(view.getByRole('button', { name: '2027年4月' }));
    expect(onSelectDate).toHaveBeenCalledWith('2027-04-01');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('移動に失敗した場合は年月ピッカー内で再試行できる', async () => {
    const user = userEvent.setup();
    const onSelectDate = jest.fn().mockResolvedValue(false);
    const onClose = jest.fn();
    const view = await render(<CalendarDatePicker month="2026-09-01" topOffset={60}
      error={null} onSelectDate={onSelectDate} onClose={onClose} />);
    const april = view.getByRole('button', { name: '2026年4月' });
    await user.press(april);
    expect(onClose).not.toHaveBeenCalled();
    expect(view.getByRole('alert')).toHaveTextContent('表示期間を読み込めませんでした');
    expect(april).toBeEnabled();
  });
});

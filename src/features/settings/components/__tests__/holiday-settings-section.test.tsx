import { fireEvent, render } from '@testing-library/react-native';
import { DeadlineAdjustmentSetting, HolidayDisplaySetting } from '../holiday-settings-section';
import { ThisWeekDeadlineSettings } from '../this-week-deadline-settings';
import type { HolidayPreferencesState } from '../../hooks/use-holiday-preferences';

jest.mock('@/global.css', () => ({}));

const state: HolidayPreferencesState = {
  status: 'ready',
  value: { version: 1, calendarId: 'jp', adjustThisWeekDeadline: false },
  isSaving: false,
  error: null,
  setValue: jest.fn(),
  reload: jest.fn(),
};

describe('祝日設定の操作', () => {
  it('祝日のスイッチには同じ意味の説明を添えない', async () => {
    const view = await render(<HolidayDisplaySetting state={state} showError />);
    const title = '日本の祝日を表示';
    expect(view.getByRole('switch', { name: title }).props.accessibilityHint).toBeUndefined();
    expect(view.queryByText('カレンダーに祝日名を表示します。', { includeHiddenElements: true })).toBeNull();
  });

  it('祝日表示のスイッチは締切調整を維持して日本の祝日をオン・オフにする', async () => {
    const setValue = jest.fn();
    const preferences = { ...state, value: { ...state.value, adjustThisWeekDeadline: true }, setValue };
    const view = await render(<HolidayDisplaySetting state={preferences} showError />);
    const visibilitySwitch = () => view.getByRole('switch', { name: '日本の祝日を表示' });

    expect(visibilitySwitch().props.value).toBe(true);
    await fireEvent(visibilitySwitch(), 'valueChange', false);
    expect(setValue).toHaveBeenLastCalledWith({ version: 1, calendarId: 'none', adjustThisWeekDeadline: true });

    await view.rerender(<HolidayDisplaySetting state={{
      ...preferences,
      value: { ...preferences.value, calendarId: 'none' },
    }} showError />);
    expect(visibilitySwitch().props.value).toBe(false);
    await fireEvent(visibilitySwitch(), 'valueChange', true);
    expect(setValue).toHaveBeenLastCalledWith({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: true });
  });

  it('祝日を表示しない場合の締切調整を説明し、祝日の設定を維持して調整を変更する', async () => {
    const setValue = jest.fn();
    const view = await render(<DeadlineAdjustmentSetting state={{
      ...state,
      value: { ...state.value, calendarId: 'none' },
      setValue,
    }} showError />);

    const title = '締切を直前の平日に繰り上げる';
    const description = '祝日を非表示にすると、土日だけ除外します。';
    const adjustment = view.getByRole('switch', { name: title });
    const visibleCopy = { includeHiddenElements: true };
    expect(view.getByText(title, visibleCopy).parent?.children.includes(view.getByText(description, visibleCopy))).toBe(true);
    expect(adjustment).toHaveProp('accessibilityHint', description);
    await fireEvent(adjustment, 'valueChange', true);
    expect(setValue).toHaveBeenCalledWith({ version: 1, calendarId: 'none', adjustThisWeekDeadline: true });
  });

  it('読込失敗時は変更を防ぎ、再読み込みを提供する', async () => {
    const reload = jest.fn();
    const view = await render(<HolidayDisplaySetting state={{
      ...state,
      status: 'error',
      error: '読込失敗',
      reload,
    }} showError />);

    expect(view.getByRole('switch', { name: '日本の祝日を表示' })).toBeDisabled();
    expect(view.getByRole('alert')).toHaveTextContent('読込失敗');
    await fireEvent.press(view.getByRole('button', { name: '祝日設定を再読み込み' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('締切を適用する範囲はセクションのフッターで説明する', async () => {
    const view = await render(<ThisWeekDeadlineSettings holidays={state}
      deadline={{ status: 'ready', weekday: 5, error: null, isSaving: false, reload: jest.fn(), setWeekday: jest.fn() }} />);
    const heading = view.getByRole('header', { name: '今週中の締切' });
    const description = view.getByText('既存の予定の日付は変わりません。');

    expect(heading.parent?.children.includes(description)).toBe(true);
  });
});

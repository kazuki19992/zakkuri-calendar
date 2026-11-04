import { fireEvent, render } from '@testing-library/react-native';
import { HolidaySettingsSection } from '../holiday-settings-section';
import type { HolidayPreferencesState } from '../../hooks/use-holiday-preferences';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => true }));

const state: HolidayPreferencesState = { status: 'ready', value: { version: 1, calendarId: 'jp', adjustThisWeekDeadline: false },
  isSaving: false, error: null, setValue: jest.fn(), reload: jest.fn() };

describe('祝日設定の操作', () => {
  it('共通シートで祝日を無効化し、調整Switchを独立して変更できる', async () => {
    const setValue = jest.fn();
    const view = await render(<HolidaySettingsSection state={{ ...state, setValue }} />);
    await fireEvent.press(view.getByRole('button', { name: '祝日カレンダー、日本' }));
    await fireEvent.press(view.getByRole('button', { name: '表示しない' }));
    expect(setValue).toHaveBeenCalledWith({ version: 1, calendarId: 'none', adjustThisWeekDeadline: false });
    await fireEvent(view.getByRole('switch'), 'valueChange', true);
    expect(setValue).toHaveBeenCalledWith({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: true });
  });
  it('無効化時の意味を説明し、読込失敗の再試行を提供する', async () => {
    const reload = jest.fn();
    const view = await render(<HolidaySettingsSection state={{ ...state, status: 'error', value: { ...state.value, calendarId: 'none' }, error: '読込失敗', reload }} />);
    expect(view.getByText('祝日を表示せず、締切調整では土日のみを除外します。')).toBeOnTheScreen();
    expect(view.getByRole('button', { name: '祝日カレンダー、表示しない' })).toBeDisabled();
    await fireEvent.press(view.getByRole('button', { name: '祝日設定を再読み込み' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from '../settings-screen';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => true }));

const weekStart = {
  status: 'ready' as const, value: 1 as const, error: null, isSaving: false,
  setValue: jest.fn(), reload: jest.fn(),
};

describe('設定画面', () => {
  it('今週中の締切曜日を金土日から選べる', async () => {
    const setWeekday = jest.fn();
    await render(<SettingsScreen weekStart={weekStart} state={{
      status: 'ready', weekday: 5, error: null, isSaving: false, setWeekday,
    }} />);

    expect(screen.getByRole('header', { name: '設定' })).toBeOnTheScreen();
    expect(screen.getByText('ざっくり予定')).toBeOnTheScreen();
    expect(screen.getByText('今週中の締切')).toBeOnTheScreen();
    expect(screen.getByText('設定変更は保存済みの予定には影響しません')).toBeOnTheScreen();
    expect(screen.getByLabelText('金曜日').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByLabelText('日曜日'));
    expect(setWeekday).toHaveBeenCalledWith(7);
  });

  it('週の開始曜日を共通シートで単一選択する', async () => {
    const setValue = jest.fn();
    await render(<SettingsScreen weekStart={{ ...weekStart, setValue }} state={{
      status: 'ready', weekday: 5, error: null, isSaving: false, setWeekday: jest.fn(),
    }} />);
    await fireEvent.press(screen.getByRole('button', { name: '週の開始曜日、月曜日' }));
    await fireEvent.press(screen.getAllByRole('button', { name: '日曜日' })[0]);
    expect(setValue).toHaveBeenCalledWith(0);
  });

  it('週開始設定の読込失敗を再試行できる', async () => {
    const reload = jest.fn();
    await render(<SettingsScreen weekStart={{ ...weekStart, status: 'error', error: '設定を読み込めませんでした。', reload }} state={{
      status: 'ready', weekday: 5, error: null, isSaving: false, setWeekday: jest.fn(),
    }} />);
    expect(screen.getByRole('button', { name: '週の開始曜日、月曜日' })).toBeDisabled();
    fireEvent.press(screen.getByRole('button', { name: '週開始設定を再読み込み' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

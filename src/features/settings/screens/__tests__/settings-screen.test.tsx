import { fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from '../settings-screen';

jest.mock('@/global.css', () => ({}));

describe('設定画面', () => {
  it('今週中の締切曜日を金土日から選べる', async () => {
    const setWeekday = jest.fn();
    await render(<SettingsScreen state={{
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
});

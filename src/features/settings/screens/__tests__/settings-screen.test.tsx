import { render, screen } from '@testing-library/react-native';
import { SettingsScreen } from '../settings-screen';

jest.mock('@/global.css', () => ({}));

describe('設定画面', () => {
  it('作り込み前の見出しだけを表示する', async () => {
    await render(<SettingsScreen />);

    expect(screen.getByRole('header', { name: '設定' })).toBeOnTheScreen();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

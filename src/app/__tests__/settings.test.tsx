import { render, screen } from '@testing-library/react-native';
import SettingsRoute from '../settings';

jest.mock('@/global.css', () => ({}));
jest.mock('@/features/settings/screens/settings-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SettingsScreen: () => React.createElement(Text, null, '設定feature screen') };
});

describe('設定route', () => {
  it('feature screenだけを組み立てる', async () => {
    await render(<SettingsRoute />);
    expect(screen.getByText('設定feature screen')).toBeOnTheScreen();
  });
});

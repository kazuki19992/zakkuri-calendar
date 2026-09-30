import { render, screen } from '@testing-library/react-native';
import SettingsRoute from '../settings';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useRelativeDateSettings } from '@/features/settings/hooks/use-relative-date-settings';

jest.mock('@/global.css', () => ({}));
jest.mock('@/data/sqlite/app-database-provider', () => ({ useRepositories: jest.fn() }));
jest.mock('@/features/settings/hooks/use-relative-date-settings', () => ({ useRelativeDateSettings: jest.fn() }));
jest.mock('@/features/settings/screens/settings-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SettingsScreen: () => React.createElement(Text, null, '設定feature screen') };
});

describe('設定route', () => {
  it('feature screenだけを組み立てる', async () => {
    jest.mocked(useRepositories).mockReturnValue({ settings: {} } as never);
    jest.mocked(useRelativeDateSettings).mockReturnValue({ status: 'ready', weekday: 5 } as never);
    await render(<SettingsRoute />);
    expect(screen.getByText('設定feature screen')).toBeOnTheScreen();
  });
});

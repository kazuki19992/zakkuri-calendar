import { render, screen } from '@testing-library/react-native';

import TabLayout from '../_layout';

jest.mock('expo-router', () => ({
  DarkTheme: {},
  DefaultTheme: {},
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
}));

jest.mock('@/components/animated-icon', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AnimatedSplashOverlay: () => React.createElement(Text, null, 'animated splash overlay'),
  };
});

jest.mock('@/components/app-tabs', () => () => null);

jest.mock('@/data/sqlite/app-database-provider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AppDatabaseProvider: () => React.createElement(Text, null, 'database initialization failed'),
  };
});

describe('TabLayout', () => {
  it('keeps the splash overlay mounted when database initialization fails', async () => {
    await render(<TabLayout />);

    expect(screen.getByText('database initialization failed')).toBeTruthy();
    expect(screen.getByText('animated splash overlay')).toBeTruthy();
  });
});

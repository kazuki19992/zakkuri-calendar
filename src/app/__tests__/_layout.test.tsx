import { render, screen } from '@testing-library/react-native';

import RootLayout from '../_layout';

jest.mock('@/global.css', () => ({}));

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DarkTheme: {},
    DefaultTheme: {},
    ThemeProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'theme-provider' }, children),
    Stack: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'router-stack' }, children),
  };
});

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
}));

jest.mock('@/components/animated-icon', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AnimatedSplashOverlay: () => React.createElement(View, { testID: 'animated-splash-overlay' }),
  };
});

jest.mock('@/data/sqlite/app-database-provider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AppDatabaseProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'database-provider' }, children),
  };
});

jest.mock('@/features/calendar/calendar-refresh-context', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CalendarRefreshProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'calendar-refresh-provider' }, children),
  };
});

describe('ルートレイアウト', () => {
  it('データベースと再読み込みproviderの内側に通常のStackを置く', async () => {
    await render(<RootLayout />);

    const splashOverlay = screen.getByTestId('animated-splash-overlay');
    const databaseProvider = screen.getByTestId('database-provider');
    const calendarRefreshProvider = screen.getByTestId('calendar-refresh-provider');
    const stack = screen.getByTestId('router-stack');

    expect(splashOverlay.parent).toBe(databaseProvider.parent);
    expect(calendarRefreshProvider.parent).toBe(databaseProvider);
    expect(stack.parent).toBe(calendarRefreshProvider);
  });
});

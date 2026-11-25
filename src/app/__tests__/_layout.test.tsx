import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { preventAutoHideAsync } from 'expo-splash-screen';

import RootLayout from '../_layout';
import * as rootLayout from '../_layout';
import { renderRouter, testRouter } from 'expo-router/testing-library';

jest.mock('@/features/notifications/notification-context', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { NotificationProvider: ({children}: {children: React.ReactNode}) => React.createElement(View, {testID:'notification-provider'}, children) };
});
jest.mock('@/global.css', () => ({}));

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GestureHandlerRootView: (props: React.ComponentProps<typeof View>) => React.createElement(View, props),
  };
});

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, { testID: 'router-stack' }, children);
  function StackScreen({ name, options }: { name: string; options: Record<string, unknown> }) {
    return React.createElement(
      Text,
      { testID: `stack-screen.${name}`, ...options },
      String(options.presentation ?? 'screen'),
    );
  }
  Stack.Screen = StackScreen;
  return {
    DarkTheme: {},
    DefaultTheme: {},
    ThemeProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'theme-provider' }, children),
    Stack,
  };
});

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
}));

jest.mock('@/data/sqlite/app-database-provider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const useRepositories = () => ({
    calendars: { getDefault: jest.fn().mockResolvedValue({ colorId: 'blue' }) },
    settings: { getPrimaryCalendarColor: jest.fn().mockResolvedValue(null) },
  });
  const repositories = useRepositories();
  return {
    useRepositories: () => repositories,
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
  it.each(['/events/new', '/events/event-1'])('直接起動した%sにもカレンダーへの戻り先を保持する', async (path) => {
    const { Stack: RouterStack } = jest.requireActual<typeof import('expo-router')>('expo-router');
    const view = await renderRouter({
      _layout: { default: () => <RouterStack />, unstable_settings: rootLayout.unstable_settings },
      index: () => null,
      'events/new': () => null,
      'events/[id]': () => null,
    }, { initialUrl: path });

    expect(view.getPathname()).toBe(path);
    expect(testRouter.canGoBack()).toBe(true);
    await testRouter.back();
    expect(view.getPathname()).toBe('/');
  });

  it('データベースと再読み込みproviderの内側に通常のStackを置く', async () => {
    await render(<RootLayout />);

    expect(preventAutoHideAsync).not.toHaveBeenCalled();
    const databaseProvider = screen.getByTestId('database-provider');
    const calendarRefreshProvider = screen.getByTestId('calendar-refresh-provider');
    const stack = screen.getByTestId('router-stack');
    const notificationProvider = screen.getByTestId('notification-provider');

    expect(calendarRefreshProvider.parent).toBe(databaseProvider);
    expect(notificationProvider.parent).toBe(calendarRefreshProvider);
    expect(stack.parent).toBe(notificationProvider);
    for (const route of ['events/new', 'events/[id]', 'events/detail/[id]']) {
      expect(screen.getByTestId(`stack-screen.${route}`).props).toMatchObject(
        Platform.OS === 'ios'
          ? { presentation: 'formSheet', sheetAllowedDetents: [0.96] }
          : { presentation: 'modal' },
      );
    }
    expect(screen.getByTestId('stack-screen.settings/temporal/index')).toHaveProp('title', 'ざっくり時間のカスタム');
    expect(screen.getByTestId('stack-screen.settings').props).toMatchObject({
      headerShown: true,
      title: '設定',
      headerBackButtonDisplayMode: 'minimal',
      gestureEnabled: true,
      animation: 'slide_from_right',
    });
  });

  it('すべての画面をflex 1のgesture handler root配下へ置く', async () => {
    await render(<RootLayout />);

    const gestureRoot = screen.getByTestId('gesture-handler-root');
    expect(StyleSheet.flatten(gestureRoot.props.style)).toMatchObject({ flex: 1 });
    expect(screen.getByTestId('theme-provider').parent).toBe(gestureRoot);
  });
});

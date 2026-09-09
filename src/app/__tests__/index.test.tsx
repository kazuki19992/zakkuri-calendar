import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import IndexRoute from '../index';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useMonthCalendar, type MonthCalendarState } from '@/features/calendar/hooks/use-month-calendar';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('expo-device', () => ({ isDevice: false }));

jest.mock('@/data/holidays/japanese-holiday-provider', () => ({
  JapaneseHolidayProvider: class JapaneseHolidayProvider {
    list() {
      return { status: 'available', holidays: [] };
    }
  },
}));

jest.mock('@/data/sqlite/app-database-provider', () => ({ useRepositories: jest.fn() }));

jest.mock('@/features/calendar/hooks/use-month-calendar', () => ({ useMonthCalendar: jest.fn() }));
jest.mock('@/features/calendar/calendar-refresh-context', () => ({ useCalendarRefresh: jest.fn() }));

jest.mock('@/features/calendar/screens/month-calendar-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MonthCalendarScreen: ({ state, onAddEvent }: { state: MonthCalendarState; onAddEvent(date: string): void }) => {
      const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
      return React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: '予定を追加', onPress: () => onAddEvent('2026-09-21') },
        React.createElement(Text, null, `月画面:${state.visibleMonth}`),
      );
    },
  };
});

jest.mock('@/components/animated-icon', () => ({ AnimatedIcon: () => null }));
jest.mock('@/components/hint-row', () => ({ HintRow: () => null }));
jest.mock('@/components/themed-text', () => ({ ThemedText: () => null }));
jest.mock('@/components/themed-view', () => ({
  ThemedView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/web-badge', () => ({ WebBadge: () => null }));

describe('ホームルート', () => {
  it('Repositoryと祝日providerを組み立てて画面へ状態だけを渡す', async () => {
    const user = userEvent.setup();
    const push = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    const repositories = {
      calendars: { getDefault: jest.fn() },
      events: {
        create: jest.fn(),
        getById: jest.fn(),
        listByAnchorRange: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      temporalDefinitions: {
        listEnabled: jest.fn(),
        getById: jest.fn(),
        disable: jest.fn(),
      },
      settings: {
        getDefaultExactDuration: jest.fn(),
        setDefaultExactDuration: jest.fn(),
        getUndeterminedFadeMinutes: jest.fn(),
      },
    };
    const state = { visibleMonth: '2026-09-01' } as MonthCalendarState;
    jest.mocked(useRepositories).mockReturnValue(repositories);
    jest.mocked(useCalendarRefresh).mockReturnValue({ revision: 4, notifyChanged: jest.fn() });
    jest.mocked(useMonthCalendar).mockReturnValue(state);

    await render(<IndexRoute />);

    expect(useMonthCalendar).toHaveBeenCalledWith({
      calendars: repositories.calendars,
      events: repositories.events,
      temporalDefinitions: repositories.temporalDefinitions,
      holidayProvider: expect.objectContaining({ constructor: expect.any(Function) }),
      refreshRevision: 4,
      weekStartsOn: 1,
    });
    expect(screen.getByText('月画面:2026-09-01')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: '予定を追加' }));
    expect(push).toHaveBeenCalledWith({ pathname: '/events/new', params: { date: '2026-09-21' } });
  });
});

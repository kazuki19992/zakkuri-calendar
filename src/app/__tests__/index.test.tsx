import { render, screen } from '@testing-library/react-native';

import IndexRoute from '../index';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useMonthCalendar, type MonthCalendarState } from '@/features/calendar/hooks/use-month-calendar';

jest.mock('@/global.css', () => ({}));

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
    MonthCalendarScreen: ({ state }: { state: MonthCalendarState }) =>
      React.createElement(Text, null, `月画面:${state.visibleMonth}`),
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
  });
});

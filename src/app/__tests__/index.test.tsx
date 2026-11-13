import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import IndexRoute from '../index';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import { useCalendarView, type CalendarViewState } from '@/features/calendar/hooks/use-calendar-view';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: jest.fn(() => ({})) }));
jest.mock('@/features/calendar/components/calendar-day-preview', () => ({ CalendarDayPreview: () => null }));

jest.mock('expo-device', () => ({ isDevice: false }));

jest.mock('@/data/holidays/japanese-holiday-provider', () => ({
  JapaneseHolidayProvider: class JapaneseHolidayProvider {
    list() {
      return { status: 'available', holidays: [] };
    }
  },
}));

jest.mock('@/data/sqlite/app-database-provider', () => ({ useRepositories: jest.fn() }));

jest.mock('@/features/calendar/hooks/use-calendar-view', () => ({ useCalendarView: jest.fn() }));
jest.mock('@/features/calendar/calendar-refresh-context', () => ({ useCalendarRefresh: jest.fn() }));

jest.mock('@/features/calendar/screens/calendar-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CalendarScreen: ({
      state,
      onAddEvent,
      onEditEvent,
      onCreateExactAt,
      onOpenSettings,
    }: {
      state: CalendarViewState;
      onAddEvent(date: string): void;
      onEditEvent?(id: string, originalOccurrenceDate?: string): void;
      onCreateExactAt?(date: string, startTime: string): void;
      onOpenSettings?(): void;
    }) => {
      const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: '予定を追加', onPress: () => onAddEvent('2026-09-21') },
          React.createElement(Text, null, `カレンダー画面:${state.mode}`),
        ),
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: '予定を編集', onPress: () => onEditEvent?.('event-1', '2026-10-12') },
          React.createElement(Text, null, '予定を編集'),
        ),
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: '時刻から予定を追加', onPress: () => onCreateExactAt?.('2026-09-22', '14:00') },
          React.createElement(Text, null, '時刻から予定を追加'),
        ),
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: '設定を開く', onPress: onOpenSettings },
          React.createElement(Text, null, '設定を開く'),
        ),
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
  it('初回URLの日付を最初の取得へ渡し、履歴を追加せず1日表示へ切り替える', async () => {
    const showDay = jest.fn().mockResolvedValue(true);
    const setParams = jest.fn();
    jest.mocked(useLocalSearchParams).mockReturnValue({ day: '2026-12-31', request: 'preview-a' });
    jest.mocked(useRepositories).mockReturnValue({} as ReturnType<typeof useRepositories>);
    jest.mocked(useCalendarRefresh).mockReturnValue({ revision: 0, notifyChanged: jest.fn() });
    jest.mocked(useCalendarView).mockReturnValue({ status: 'ready', mode: 'day', isPeriodLoading: false, showDay } as unknown as CalendarViewState);
    jest.mocked(useRouter).mockReturnValue({ setParams } as unknown as ReturnType<typeof useRouter>);
    await render(<IndexRoute />);
    expect(useCalendarView).toHaveBeenLastCalledWith(expect.objectContaining({ initialDay: '2026-12-31' }));
    expect(showDay).toHaveBeenCalledWith('2026-12-31');
    await screen.findByText('カレンダー画面:day');
    expect(setParams).toHaveBeenCalledWith({ day: undefined, request: undefined });
    jest.mocked(useLocalSearchParams).mockReturnValue({});
  });
  it('Repositoryと祝日providerを組み立てて画面へ状態だけを渡す', async () => {
    const user = userEvent.setup();
    const push = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    const repositories = { notifications: { readSnapshot: jest.fn(), getRevision: jest.fn(), markApplied: jest.fn(), recordFailure: jest.fn() },
      calendars: { getDefault: jest.fn(), setColor: jest.fn() },
      events: {
        create: jest.fn(),
        getById: jest.fn(),
        listByAnchorRange: jest.fn(),
        readTemporalSchedule: jest.fn(), listSchedule: jest.fn(),
        getOccurrenceEditData: jest.fn(),
        saveOccurrenceException: jest.fn(),
        deleteOccurrenceException: jest.fn(),
        applyRecurrenceMutation: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      temporalDefinitions: {
        listEditable: jest.fn(), previewUpdate: jest.fn(), updateDefinition: jest.fn(), listEnabled: jest.fn(),
        getById: jest.fn(),
        disable: jest.fn(),
      },
      settings: {
        getNotificationDefault: jest.fn().mockResolvedValue(null), setNotificationDefault: jest.fn(), getDefaultExactDuration: jest.fn(),
        setDefaultExactDuration: jest.fn(),
        setUndeterminedFadeMinutes: jest.fn(), getUndeterminedFadeMinutes: jest.fn(),
        getCalendarVisible: jest.fn(),
        setCalendarVisible: jest.fn(),
        getLastEventEditorTab: jest.fn(),
        setLastEventEditorTab: jest.fn(),
        getLastCalendarViewMode: jest.fn(),
    getHolidayPreferences: jest.fn().mockResolvedValue({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: false }), setHolidayPreferences: jest.fn().mockResolvedValue(undefined), getCalendarWeekStartsOn: jest.fn().mockResolvedValue(1),
    setCalendarWeekStartsOn: jest.fn().mockResolvedValue(undefined),
        setLastCalendarViewMode: jest.fn(),
        getThisWeekDeadlineWeekday: jest.fn(),
        setThisWeekDeadlineWeekday: jest.fn(),
      },
    };
    const state = { mode: 'twoDay' } as CalendarViewState;
    jest.mocked(useRepositories).mockReturnValue(repositories);
    jest.mocked(useCalendarRefresh).mockReturnValue({ revision: 4, notifyChanged: jest.fn() });
    jest.mocked(useCalendarView).mockReturnValue(state);

    await render(<IndexRoute />);

    expect(useCalendarView).toHaveBeenCalledWith({
      calendars: repositories.calendars,
      events: repositories.events,
      settings: repositories.settings,
      temporalDefinitions: repositories.temporalDefinitions,
      holidayProvider: expect.objectContaining({ constructor: expect.any(Function) }),
      refreshRevision: 4,
    });
    expect(screen.getByText('カレンダー画面:twoDay')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: '予定を追加' }));
    expect(push).toHaveBeenCalledWith({ pathname: '/events/new', params: { date: '2026-09-21' } });
    await user.press(screen.getByRole('button', { name: '予定を編集' }));
    expect(push).toHaveBeenCalledWith({
      pathname: '/events/[id]', params: { id: 'event-1', occurrenceDate: '2026-10-12' },
    });
    await user.press(screen.getByRole('button', { name: '時刻から予定を追加' }));
    expect(push).toHaveBeenCalledWith({
      pathname: '/events/new',
      params: { date: '2026-09-22', startTime: '14:00', temporalType: 'exact' },
    });
    await user.press(screen.getByRole('button', { name: '設定を開く' }));
    expect(push).toHaveBeenCalledWith('/settings');
  });
});

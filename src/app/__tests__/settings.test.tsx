import { render, screen } from '@testing-library/react-native';
import SettingsRoute from '../settings';
import { useRepositories } from '@/data/sqlite/app-database-provider';

jest.mock('@/features/notifications/notification-context', () => ({ useNotifications: () => ({ state: {permission:'unsupported'} }) }));
jest.mock('@/features/settings/hooks/use-notification-defaults', () => ({ useNotificationDefaults: () => ({entries:{}}) }));
jest.mock('@/features/settings/hooks/use-calendar-backup', () => ({ useCalendarBackup: () => undefined }));
jest.mock('@/global.css', () => ({}));
jest.mock('@/data/sqlite/app-database-provider', () => ({ useRepositories: jest.fn(), useCalendarBackupWriter: () => jest.fn() }));
jest.mock('@/features/settings/hooks/use-undetermined-duration-settings', () => ({ useUndeterminedDurationSettings: () => ({ minutes: 120, isSaving: false }) }));
jest.mock('@/features/settings/hooks/use-settings-leave-guard', () => ({ useSettingsLeaveGuard: jest.fn() }));
jest.mock('@/features/settings/hooks/use-week-start-settings', () => ({ useWeekStartSettings: jest.fn() }));
jest.mock('@/features/settings/hooks/use-holiday-preferences', () => ({ useHolidayPreferences: jest.fn() }));
jest.mock('@/features/calendar/calendar-refresh-context', () => ({ useCalendarRefresh: () => ({ notifyChanged: jest.fn() }) }));
jest.mock('@/features/settings/screens/settings-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SettingsScreen: () => React.createElement(Text, null, '設定feature screen') };
});

describe('設定route', () => {
  it('feature screenだけを組み立てる', async () => {
    jest.mocked(useRepositories).mockReturnValue({ settings: {} } as never);
    await render(<SettingsRoute />);
    expect(screen.getByText('設定feature screen')).toBeOnTheScreen();
  });
});

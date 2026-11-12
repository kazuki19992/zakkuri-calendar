import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { NotificationProvider } from '../notification-context';
import { createNotificationDevice } from '@/data/notifications/notification-device';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
jest.mock('@/global.css', () => ({}));
jest.mock('@/data/sqlite/app-database-provider', () => ({
  useRepositories: jest.fn(),
}));
jest.mock('@/features/calendar/calendar-refresh-context', () => ({
  useCalendarRefresh: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRootNavigationState: () => ({ key: 'root' }),
  useRouter: () => mockRouter,
}));
jest.mock('@/data/notifications/notification-device', () => ({
  createNotificationDevice: jest.fn(),
  observeNotificationEvents: () => () => {},
}));
const mockRouter = { push: jest.fn(), replace: jest.fn() };
describe('保存済み通知の許可案内', () => {
  test('起動時にOS許可を要求せず、案内のボタン操作後だけ要求する', async () => {
    let permission = 'undetermined';
    const device = {
      permission: jest.fn(async () => permission),
      requestPermission: jest.fn(async () => {
        permission = 'granted';
        return permission;
      }),
      list: async () => [],
      schedule: async () => {},
      cancel: async () => {},
      openSettings: async () => {},
      openAlarmSettings: async () => {},
    };
    jest.mocked(createNotificationDevice).mockReturnValue(device as never);
    jest
      .mocked(useRepositories)
      .mockReturnValue({
        events: {},
        notifications: {
          readSnapshot: async () => ({
            revision: 0,
            definitions: [],
            exceptions: [],
            aggregates: [
              {
                event: {
                  id: 'e',
                  calendarId: 'c',
                  title: '予定',
                  temporalType: 'exact',
                  anchorDate: '2026-11-13',
                  startTime: '12:00',
                  duration: { type: 'fixed', minutes: 60 },
                  recurrenceRule: null,
                  createdTimeZoneId: 'Asia/Tokyo',
                  createdAt: '',
                  updatedAt: '',
                  location: null,
                  noteDocument: null,
                  colorId: null,
                },
                reminders: [
                  { id: 'r', eventId: 'e', sortOrder: 0, minutesBefore: 10 },
                ],
              },
            ],
          }),
          getRevision: async () => 0,
          markApplied: async () => true,
          recordFailure: async () => {},
        },
      } as never);
    jest
      .mocked(useCalendarRefresh)
      .mockReturnValue({ revision: 0, notifyChanged: () => {} });
    const view = await render(
      <NotificationProvider>
        <Text>カレンダー</Text>
      </NotificationProvider>,
    );
    await waitFor(() =>
      expect(
        view.getByRole('button', { name: '通知を許可する' }),
      ).toBeOnTheScreen(),
    );
    expect(device.requestPermission).not.toHaveBeenCalled();
    await act(async () => {
      await fireEvent.press(
        view.getByRole('button', { name: '通知を許可する' }),
      );
    });
    await waitFor(() =>
      expect(device.requestPermission).toHaveBeenCalledTimes(1),
    );
  });
});

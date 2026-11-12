import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { NotificationProvider } from '../notification-context';
import { createNotificationDevice } from '@/data/notifications/notification-device';
import { useRepositories } from '@/data/sqlite/app-database-provider';
import { useCalendarRefresh } from '@/features/calendar/calendar-refresh-context';
import type {
  NotificationPermission,
  NotificationDevice,
  NotificationSnapshot,
} from '@/domain/notifications/ports';
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
function setup() {
  let permission: NotificationPermission = 'undetermined',
    failList = false;
  const device: NotificationDevice = {
    permission: jest.fn(async () => permission),
    requestPermission: jest.fn(async () => {
      permission = 'granted';
      return permission;
    }),
    list: async () => {
      if (failList) throw Error('schedule');
      return [];
    },
    schedule: async () => {},
    cancel: async () => {},
    openSettings: async () => {},
    openAlarmSettings: async () => {},
  };
  const snapshot: NotificationSnapshot = {
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
          anchorDate: '2030-11-13',
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
        reminders: [{ id: 'r', eventId: 'e', sortOrder: 0, minutesBefore: 10 }],
      },
    ],
  };
  jest.mocked(createNotificationDevice).mockReturnValue(device);
  jest
    .mocked(useRepositories)
    .mockReturnValue({
      events: {},
      notifications: {
        readSnapshot: async () => snapshot,
        getRevision: async () => 0,
        markApplied: async () => true,
        recordFailure: async () => {},
      },
    } as never);
  jest
    .mocked(useCalendarRefresh)
    .mockReturnValue({ revision: 0, notifyChanged: () => {} });
  return {
    device,
    fail: () => {
      permission = 'granted';
      failList = true;
    },
    recover: () => {
      failList = false;
    },
    refresh: (revision: number) =>
      jest
        .mocked(useCalendarRefresh)
        .mockReturnValue({ revision, notifyChanged: () => {} }),
  };
}
const content = () => (
  <NotificationProvider>
    <Text>カレンダー</Text>
  </NotificationProvider>
);
describe('保存済み通知の許可案内', () => {
  test('起動時にOS許可を要求せず、案内のボタン操作後だけ要求する', async () => {
    const e = setup(),
      v = await render(content());
    await waitFor(() =>
      expect(
        v.getByRole('button', { name: '通知を許可する' }),
      ).toBeOnTheScreen(),
    );
    expect(e.device.requestPermission).not.toHaveBeenCalled();
    await fireEvent.press(v.getByRole('button', { name: '通知を許可する' }));
    await waitFor(() =>
      expect(e.device.requestPermission).toHaveBeenCalledTimes(1),
    );
  });
  test('許可案内を閉じても後の同期失敗は再表示し別の失敗も隠さない', async () => {
    const e = setup(),
      v = await render(content());
    await waitFor(() =>
      expect(v.getByRole('button', { name: '後で' })).toBeOnTheScreen(),
    );
    await fireEvent.press(v.getByRole('button', { name: '後で' }));
    e.fail();
    e.refresh(1);
    await v.rerender(content());
    await waitFor(() =>
      expect(v.getByRole('button', { name: '通知を再試行' })).toBeOnTheScreen(),
    );
    await fireEvent.press(v.getByRole('button', { name: '後で' }));
    e.recover();
    e.refresh(2);
    await v.rerender(content());
    await waitFor(() =>
      expect(v.queryByRole('button', { name: '通知を再試行' })).toBeNull(),
    );
    e.fail();
    e.refresh(3);
    await v.rerender(content());
    await waitFor(() =>
      expect(v.getByRole('button', { name: '通知を再試行' })).toBeOnTheScreen(),
    );
  });
  test('許可要求失敗の再試行は予約処理ではなく許可要求を再実行する', async () => {
    const e = setup();
    jest
      .mocked(e.device.requestPermission)
      .mockRejectedValueOnce(Error('permission'));
    const v = await render(content());
    await waitFor(() =>
      expect(
        v.getByRole('button', { name: '通知を許可する' }),
      ).toBeOnTheScreen(),
    );
    await act(async () => {
      await fireEvent.press(v.getByRole('button', { name: '通知を許可する' }));
    });
    await waitFor(() =>
      expect(
        v.getByRole('button', { name: '通知の許可を再試行' }),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(
      v.getByRole('button', { name: '通知の許可を再試行' }),
    );
    await waitFor(() =>
      expect(e.device.requestPermission).toHaveBeenCalledTimes(2),
    );
  });
});

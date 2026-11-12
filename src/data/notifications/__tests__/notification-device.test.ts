import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  createNotificationDevice,
  readDeviceRequest,
  observeNotificationEvents,
} from '../notification-device.native';
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
    DENIED: 1,
    NOT_DETERMINED: 0,
  },
  AndroidImportance: { HIGH: 4, NONE: 0 },
  SchedulableTriggerInputTypes: { DATE: 'date', CALENDAR: 'calendar' },
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponseAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
}));
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
describe('端末通知adapter', () => {
  test('iOSの静かな許可をroot statusだけで拒否と誤認しない', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: 'undetermined',
      ios: { status: 3 },
    } as never);
    expect(await createNotificationDevice().permission()).toBe('quiet');
  });
  test('予約一覧の日時と本文を検証し、不明triggerを成功扱いにしない', () => {
    const d = { version: 1, eventId: 'e', fireAt: 100000 };
    const request = {
      identifier: 'test',
      content: { title: '予定', body: '日付', data: d },
      trigger: { type: 'date', value: 100000 },
    };
    expect(readDeviceRequest(request as never)).toMatchObject({
      fireAt: 100000,
      fingerprint: '[100000,"予定","日付",{"eventId":"e"}]',
    });
    expect(
      readDeviceRequest({ ...request, trigger: { type: 'unknown' } } as never)
        .fireAt,
    ).toBeNaN();
  });
});

test('以前の応答のackで新しい最後の応答を消さず、同じ応答だけ消去する', async () => {
  const make = (name: string, date: number) =>
    ({
      actionIdentifier: 'default',
      notification: {
        date,
        request: {
          identifier: `zakkuri.reminder.v1.${name}`,
          content: {
            title: null,
            subtitle: null,
            body: null,
            categoryIdentifier: null,
            sound: null,
            data: { version: 1, eventId: name },
          },
          trigger: null,
        },
      },
    }) as Notifications.NotificationResponse;
  const first = make('a', 1),
    second = make('b', 2);
  let last: Notifications.NotificationResponse | null = first;
  jest
    .mocked(Notifications.getLastNotificationResponse)
    .mockImplementation(() => last);
  jest
    .mocked(Notifications.clearLastNotificationResponseAsync)
    .mockImplementation(async () => {
      last = null;
    });
  const received: import('../notification-device').NotificationResponse[] = [];
  const stop = observeNotificationEvents(
    () => {},
    (r) => received.push(r),
  );
  last = second;
  const listener = jest
    .mocked(Notifications.addNotificationResponseReceivedListener)
    .mock.calls.at(-1)![0];
  listener(second);
  await received[0].acknowledge();
  expect(last).toBe(second);
  await received[1].acknowledge();
  expect(last).toBeNull();
  stop();
});

test('iOSのUTC calendar予約を読戻して同じ日時と内容へ復元する', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const fireAt = Date.UTC(2027, 0, 1, 3, 15),
    request = {
      identifier: 'test',
      key: 'key',
      fireAt,
      title: '予定',
      label: '2027-01-01',
      target: { eventId: 'e' },
      fingerprint: '[1798773300000,"予定","2027-01-01",{"eventId":"e"}]',
    };
  await createNotificationDevice().schedule(request);
  const sent = jest
    .mocked(Notifications.scheduleNotificationAsync)
    .mock.calls.at(-1)![0];
  expect(sent.trigger).toEqual({
    type: 'calendar',
    timezone: 'UTC',
    year: 2027,
    month: 1,
    day: 1,
    hour: 3,
    minute: 15,
    second: 0,
    repeats: false,
  });
  const read = readDeviceRequest({
    identifier: 'test',
    content: sent.content,
    trigger: {
      type: 'calendar',
      repeats: false,
      dateComponents: {
        timeZone: 'UTC',
        year: 2027,
        month: 1,
        day: 1,
        hour: 3,
        minute: 15,
        second: 0,
      },
    },
  } as never);
  expect(read.fireAt).toBe(1798773300000);
  expect(read.fingerprint).toBe(
    '[1798773300000,"予定","2027-01-01",{"eventId":"e"}]',
  );
});

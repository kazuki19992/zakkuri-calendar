import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  createNotificationDevice,
  readDeviceRequest,
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
  SchedulableTriggerInputTypes: { DATE: 'date' },
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

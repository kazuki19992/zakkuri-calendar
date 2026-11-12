import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import { parseNotificationTarget } from '@/domain/notifications/notification-target';
import { NOTIFICATION_PREFIX } from '@/domain/notifications/ports';
import type {
  NotificationDevice,
  NotificationPermission,
  DeviceNotification,
} from '@/domain/notifications/ports';
import type { NotificationResponse } from './notification-device';
const CHANNEL = 'event-reminders-v1';
async function channel() {
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: '予定の通知',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
}
/** iOSはDate triggerが相対秒数に変換されるため、UTC calendarの読戻し可能な形式を使う。 */
export function readDeviceRequest(
  request: Notifications.NotificationRequest,
): DeviceNotification {
  const trigger = request.trigger as unknown as Record<string, unknown> | null;
  let fireAt = NaN;
  if (trigger?.type === 'date' && typeof trigger.value === 'number')
    fireAt = trigger.value;
  if (trigger?.type === 'calendar' && trigger.repeats === false) {
    const c = trigger.dateComponents as Record<string, unknown>;
    if (
      c &&
      ['UTC', 'GMT', 'Etc/UTC', 'Etc/GMT'].includes(String(c.timeZone))
    ) {
      const values = [c.year, c.month, c.day, c.hour, c.minute, c.second ?? 0];
      if (values.every((v) => typeof v === 'number' && Number.isInteger(v)))
        fireAt = Date.UTC(
          Number(c.year),
          Number(c.month) - 1,
          Number(c.day),
          Number(c.hour),
          Number(c.minute),
          Number(c.second ?? 0),
        );
    }
  }
  const target = parseNotificationTarget(request.content.data);
  const fingerprint = target
    ? JSON.stringify([
        fireAt,
        request.content.title,
        request.content.body,
        target,
      ])
    : '';
  return { identifier: request.identifier, fireAt, fingerprint };
}
function normalizePermission(
  value: Notifications.NotificationPermissionsStatus,
): NotificationPermission {
  if (Platform.OS === 'ios') {
    const status = value.ios?.status;
    if (status === Notifications.IosAuthorizationStatus.AUTHORIZED)
      return 'granted';
    if (
      status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      status === Notifications.IosAuthorizationStatus.EPHEMERAL
    )
      return 'quiet';
    return status === Notifications.IosAuthorizationStatus.NOT_DETERMINED
      ? 'undetermined'
      : 'denied';
  }
  return value.granted
    ? 'granted'
    : value.canAskAgain
      ? 'undetermined'
      : 'denied';
}
export function createNotificationDevice(): NotificationDevice {
  const permission = async () => {
    const value = normalizePermission(
      await Notifications.getPermissionsAsync(),
    );
    if (Platform.OS === 'android' && value === 'granted') {
      const c = await Notifications.getNotificationChannelAsync(CHANNEL);
      if (c?.importance === Notifications.AndroidImportance.NONE)
        return 'denied' as const;
    }
    return value;
  };
  return {
    permission,
    requestPermission: async () => {
      await channel();
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      });
      return permission();
    },
    list: async () =>
      (await Notifications.getAllScheduledNotificationsAsync()).map(
        readDeviceRequest,
      ),
    schedule: async (request) => {
      await channel();
      const d = new Date(request.fireAt);
      const trigger: Notifications.NotificationTriggerInput =
        Platform.OS === 'ios'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              timezone: 'UTC',
              year: d.getUTCFullYear(),
              month: d.getUTCMonth() + 1,
              day: d.getUTCDate(),
              hour: d.getUTCHours(),
              minute: d.getUTCMinutes(),
              second: d.getUTCSeconds(),
              repeats: false,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: request.fireAt,
              channelId: CHANNEL,
            };
      await Notifications.scheduleNotificationAsync({
        identifier: request.identifier,
        content: {
          title: request.title,
          body: request.label,
          sound: 'default',
          data: { version: 1, ...request.target },
        },
        trigger,
      });
    },
    cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
    openSettings: () => Linking.openSettings(),
    openAlarmSettings: async () => {
      if (Platform.OS !== 'android') {
        await Linking.openSettings();
        return;
      }
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
        );
      } catch {
        await Linking.openSettings();
      }
    },
  };
}
/** SDK57ではforeground表示を明示し、受信処理でDBを待たない。 */
export function observeNotificationEvents(
  received: () => void,
  response: (value: NotificationResponse) => void,
): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  const responseId = (r: Notifications.NotificationResponse) =>
    `${r.notification.request.identifier}:${r.notification.date}:${r.actionIdentifier}`;
  const forward = (r: Notifications.NotificationResponse) => {
    if (!r.notification.request.identifier.startsWith(NOTIFICATION_PREFIX))
      return;
    const id = responseId(r);
    response({
      id,
      data: r.notification.request.content.data,
      acknowledge: async () => {
        const latest = Notifications.getLastNotificationResponse();
        if (latest && responseId(latest) === id)
          await Notifications.clearLastNotificationResponseAsync();
      },
    });
  };
  const initial = Notifications.getLastNotificationResponse();
  if (initial) forward(initial);
  const a = Notifications.addNotificationReceivedListener(received);
  const b = Notifications.addNotificationResponseReceivedListener(forward);
  return () => {
    a.remove();
    b.remove();
  };
}

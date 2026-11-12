import type { NotificationDevice } from '@/domain/notifications/ports';
export type NotificationResponse = Readonly<{
  id: string;
  data: unknown;
  acknowledge(): Promise<void>;
}>;
export function createNotificationDevice(): NotificationDevice {
  return {
    permission: async () => 'unsupported',
    requestPermission: async () => 'unsupported',
    list: async () => [],
    schedule: async () => {},
    cancel: async () => {},
    openSettings: async () => {},
    openAlarmSettings: async () => {},
  };
}
export function observeNotificationEvents(
  _received: () => void,
  _response: (response: NotificationResponse) => void,
): () => void {
  return () => {};
}

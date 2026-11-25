import type { NotificationPermission } from '@/domain/notifications/ports';

const labels: Record<NotificationPermission, string> = {
  granted: '端末の通知：許可済み',
  quiet: '端末の通知：静かな通知',
  denied: '端末の通知：未許可',
  undetermined: '端末の通知：許可前',
  unsupported: '端末通知は非対応',
};

export function notificationPermissionLabel(permission: NotificationPermission) {
  return labels[permission];
}

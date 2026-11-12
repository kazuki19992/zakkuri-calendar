import type { NotificationState } from './notification-coordinator';

/** 許可要求と予約の失敗を同じ文言・操作へまとめず、両画面で正しい再試行へ導く。 */
export function notificationFailure(
  state: Pick<NotificationState, 'status' | 'error'>,
) {
  if (state.status !== 'error') return null;
  return state.error === 'permission_failed'
    ? {
        message: '通知の許可を要求できませんでした。もう一度お試しください。',
        retryLabel: '通知の許可を再試行',
        permission: true,
      }
    : {
        message: '一部の通知を準備できませんでした。',
        retryLabel: '通知を再試行',
        permission: false,
      };
}

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NotificationSettingsSection } from '../notification-settings-section';
import type { NotificationRuntime } from '@/features/notifications/notification-context';
import type { NotificationDefaultsState } from '../../hooks/use-notification-defaults';
jest.mock('@/global.css', () => ({}));
const defaults: NotificationDefaultsState = {
  entries: {},
  setValue: async () => true,
  retry: async () => {},
};
function runtime(): NotificationRuntime {
  return {
    state: {
      status: 'ready',
      failureRevision: 0,
      permission: 'granted',
      hasReminders: true,
      deferred: false,
      through: null,
      error: null,
    },
    retry: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue(undefined),
    openSettings: jest.fn().mockResolvedValue(undefined),
    openAlarmSettings: jest.fn().mockResolvedValue(undefined),
  };
}
describe('通知設定の操作失敗と再試行', () => {
  test('OS設定を開く操作が次に成功すると古い失敗表示を消す', async () => {
    const r = runtime();
    jest.mocked(r.openSettings).mockRejectedValueOnce(Error('open'));
    const v = await render(
      <NotificationSettingsSection defaults={defaults} runtime={r} />,
    );
    await fireEvent.press(
      v.getByRole('button', { name: '端末の通知設定を開く' }),
    );
    await waitFor(() =>
      expect(v.getByText('端末の設定を開けませんでした。')).toBeOnTheScreen(),
    );
    await fireEvent.press(
      v.getByRole('button', { name: '端末の通知設定を開く' }),
    );
    await waitFor(() =>
      expect(v.queryByText('端末の設定を開けませんでした。')).toBeNull(),
    );
  });
  test('許可要求の失敗を区別し再試行は権限要求へ戻す', async () => {
    const r = runtime();
    r.state = {
      ...r.state,
      status: 'error',
      permission: 'undetermined',
      error: 'permission_failed',
    };
    const v = await render(
      <NotificationSettingsSection defaults={defaults} runtime={r} />,
    );
    expect(
      v.getByText('通知の許可を要求できませんでした。もう一度お試しください。'),
    ).toBeOnTheScreen();
    await fireEvent.press(
      v.getByRole('button', { name: '通知の許可を再試行' }),
    );
    expect(r.requestPermission).toHaveBeenCalledTimes(1);
    expect(r.retry).not.toHaveBeenCalled();
  });
});

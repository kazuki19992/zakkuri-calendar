import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
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
  test('新規予定の通知に共通する説明はセクションのフッターに置く', async () => {
    const view = await render(<NotificationSettingsSection defaults={defaults} runtime={runtime()} />);
    const heading = view.getByRole('header', { name: '新規予定の通知' });
    const description = view.getByText('通知は予定ごとに変更できます。');

    expect(heading.parent?.children.includes(description)).toBe(true);
  });

  test('Androidの正確な通知に必要な許可を端末設定へのボタン内で説明する', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const view = await render(<NotificationSettingsSection defaults={defaults} runtime={runtime()} />);
      const row = view.getByRole('button', { name: 'アラームとリマインダーの設定' });
      const description = '未許可や省電力設定では通知が遅れることがあります。';

      expect(within(row).getByText(description)).toBeOnTheScreen();
      expect(row).toHaveProp('accessibilityHint', description);
    } finally {
      platform.restore();
    }
  });

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
  test('平常時は内部の予約件数や手動の通知更新を表示しない', async () => {
    const r = runtime();
    const v = await render(<NotificationSettingsSection defaults={defaults} runtime={r} />);

    expect(v.getByRole('header', { name: '新規予定の通知' })).toBeOnTheScreen();
    expect(v.getByRole('header', { name: '端末への通知' })).toBeOnTheScreen();
    expect(v.queryByText(/60件/)).toBeNull();
    expect(v.queryByRole('button', { name: '予定の通知を更新する' })).toBeNull();
  });

  test('通知の準備に失敗したときだけ予約処理の再試行を表示する', async () => {
    const r = runtime();
    r.state = { ...r.state, status: 'error', error: 'schedule_failed' };
    const v = await render(<NotificationSettingsSection defaults={defaults} runtime={r} />);
    expect(v.getByRole('alert')).toHaveTextContent('一部の通知を準備できませんでした。');
    await fireEvent.press(v.getByRole('button', { name: '通知を再試行' }));
    expect(r.retry).toHaveBeenCalledTimes(1);
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

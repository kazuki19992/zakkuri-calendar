import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNotificationDefaults } from '../use-notification-defaults';
import { defaultReminderTiming } from '@/domain/notifications/reminder-timing';
describe('通知の既定値設定', () => {
  test('明示通知なしを保存し、失敗した入力は再試行できる', async () => {
    const settings = {
      getNotificationDefault: jest.fn(async () =>
        defaultReminderTiming('exact'),
      ),
      setNotificationDefault: jest
        .fn()
        .mockRejectedValueOnce(Error('write'))
        .mockResolvedValue(undefined),
    };
    const { result } = await renderHook(() =>
      useNotificationDefaults(settings),
    );
    await waitFor(() =>
      expect(result.current.entries.exact?.status).toBe('ready'),
    );
    await act(async () => {
      await result.current.setValue('exact', null);
    });
    expect(result.current.entries.exact?.value).toEqual({
      version: 1,
      kind: 'relativeMinutes',
      anchor: 'start',
      minutesBefore: 10,
    });
    expect(result.current.entries.exact?.error).toBeTruthy();
    await act(async () => {
      await result.current.retry('exact');
    });
    expect(result.current.entries.exact?.value).toBeNull();
  });
  test('1項目の読込み失敗が他の項目の編集を止めない', async () => {
    const settings = {
      getNotificationDefault: jest.fn(async (category: string) => {
        if (category === 'exact') throw Error('read');
        return null;
      }),
      setNotificationDefault: jest.fn(),
    };
    const { result } = await renderHook(() =>
      useNotificationDefaults(settings),
    );
    await waitFor(() =>
      expect(result.current.entries.exact?.status).toBe('error'),
    );
    expect(result.current.entries.all_day?.status).toBe('ready');
  });
});

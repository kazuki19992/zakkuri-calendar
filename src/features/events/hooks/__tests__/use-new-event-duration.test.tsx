import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNewEventDuration } from '../use-new-event-duration';

const duration = { type: 'fixed', minutes: 30 } as const;
describe('新規予定の初期長の非同期取得', () => {
  it('完了後は再試行や依存の再描画で入力を再初期化しない', async () => {
    const settings = { getDefaultExactDuration: jest.fn().mockResolvedValue(duration) };
    const onResolved = jest.fn();
    const view = await renderHook(() => useNewEventDuration({ settings, enabled: true, onResolved }));
    await waitFor(() => expect(view.result.current.status).toBe('ready'));
    await act(async () => { await view.result.current.retry(); });
    await view.rerender(undefined);
    expect(settings.getDefaultExactDuration).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledTimes(1);
  });
  it('古い依存の完了とunmount後の応答を捨てる', async () => {
    let resolve!: (value: typeof duration) => void;
    const old = { getDefaultExactDuration: jest.fn().mockReturnValue(new Promise((done) => { resolve = done; })) };
    const next = { getDefaultExactDuration: jest.fn().mockResolvedValue(duration) };
    const onResolved = jest.fn();
    const view = await renderHook((settings: typeof old) => useNewEventDuration({ settings, enabled: true, onResolved }), { initialProps: old });
    await view.rerender(next);
    await waitFor(() => expect(view.result.current.status).toBe('ready'));
    await view.unmount();
    resolve(duration);
    await Promise.resolve();
    expect(onResolved).toHaveBeenCalledTimes(1);
  });
});

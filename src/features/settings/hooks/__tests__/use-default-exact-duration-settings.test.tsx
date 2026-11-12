import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDefaultExactDurationSettings } from '../use-default-exact-duration-settings';

function dependencies() {
  return { settings: {
    getDefaultExactDuration: jest.fn().mockResolvedValue({ type: 'fixed', minutes: 60 }),
    setDefaultExactDuration: jest.fn().mockResolvedValue(undefined),
  }, now: () => '2026-11-12T00:00:00Z' };
}

describe('初期長設定の状態', () => {
  it('読込失敗から再試行でき保存失敗では前の値を保持する', async () => {
    const input = dependencies();
    input.settings.getDefaultExactDuration.mockRejectedValueOnce(new Error('synthetic'));
    const { result } = await renderHook(() => useDefaultExactDurationSettings(input));
    await waitFor(() => expect(result.current.status).toBe('error'));
    await act(async () => { await result.current.reload(); });
    expect(result.current.status).toBe('ready');
    input.settings.setDefaultExactDuration.mockRejectedValueOnce(new Error('synthetic'));
    await act(async () => { await result.current.setValue({ type: 'instant' }); });
    expect(result.current.value).toEqual({ type: 'fixed', minutes: 60 });
    expect(result.current.error).toBeTruthy();
    await act(async () => { await result.current.setValue({ type: 'instant' }); });
    expect(result.current.value).toEqual({ type: 'instant' });
    expect(result.current.error).toBeNull();
  });

  it('同値を保存せず連打を抑止し成功後にだけ表示値を確定する', async () => {
    const input = dependencies();
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    const { result } = await renderHook(() => useDefaultExactDurationSettings(input));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await result.current.setValue({ type: 'fixed', minutes: 60 }); });
    expect(input.settings.setDefaultExactDuration).not.toHaveBeenCalled();
    input.settings.setDefaultExactDuration.mockReturnValue(pending);
    let saving!: Promise<boolean>;
    await act(async () => {
      saving = result.current.setValue({ type: 'undetermined' });
      void result.current.setValue({ type: 'instant' });
      void result.current.reload();
    });
    expect(input.settings.setDefaultExactDuration).toHaveBeenCalledTimes(1);
    expect(result.current.value).toEqual({ type: 'fixed', minutes: 60 });
    await act(async () => { resolve(); await saving; });
    expect(result.current.value).toEqual({ type: 'undetermined' });
  });

  it('古い読込みやunmount後の完了で現在値を上書きしない', async () => {
    const old = dependencies();
    let resolve!: (value: { type: 'instant' }) => void;
    old.settings.getDefaultExactDuration.mockReturnValue(new Promise((done) => { resolve = done; }));
    const next = dependencies();
    const { result, rerender, unmount } = await renderHook((input: ReturnType<typeof dependencies>) => useDefaultExactDurationSettings(input), { initialProps: old });
    await rerender(next);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { resolve({ type: 'instant' }); });
    expect(result.current.value).toEqual({ type: 'fixed', minutes: 60 });
    await unmount();
  });
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useWeekStartSettings } from '../use-week-start-settings';

function dependencies() {
  return {
    settings: { getCalendarWeekStartsOn: jest.fn().mockResolvedValue(1), setCalendarWeekStartsOn: jest.fn().mockResolvedValue(undefined) },
    onSaved: jest.fn(),
    now: () => '2026-11-04T00:00:00Z',
  };
}

describe('週開始設定の状態', () => {
  it('読込失敗から再試行し、保存成功後だけ選択を変える', async () => {
    const input = dependencies();
    input.settings.getCalendarWeekStartsOn.mockRejectedValueOnce(new Error('failed'));
    const { result } = await renderHook(() => useWeekStartSettings(input));
    await waitFor(() => expect(result.current.status).toBe('error'));
    await act(async () => { await result.current.reload(); });
    expect(result.current.status).toBe('ready');
    input.settings.setCalendarWeekStartsOn.mockRejectedValueOnce(new Error('failed'));
    await act(async () => { await result.current.setValue(0); });
    expect(result.current.value).toBe(1);
    expect(input.onSaved).not.toHaveBeenCalled();
    await act(async () => { await result.current.setValue(0); });
    expect(result.current.value).toBe(0);
    expect(input.onSaved).toHaveBeenCalledTimes(1);
  });

  it('同値と連打を保存せず、unmount後も保存成功を通知する', async () => {
    const input = dependencies();
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    const { result, unmount } = await renderHook(() => useWeekStartSettings(input));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await result.current.setValue(1); });
    expect(input.settings.setCalendarWeekStartsOn).not.toHaveBeenCalled();
    input.settings.setCalendarWeekStartsOn.mockReturnValue(pending);
    let saving!: Promise<boolean>;
    await act(async () => { saving = result.current.setValue(0); void result.current.setValue(0); });
    expect(input.settings.setCalendarWeekStartsOn).toHaveBeenCalledTimes(1);
    await unmount();
    resolve();
    await saving;
    expect(input.onSaved).toHaveBeenCalledTimes(1);
  });
});

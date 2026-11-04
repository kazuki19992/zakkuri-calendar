import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useHolidayPreferences } from '../use-holiday-preferences';

describe('祝日設定の状態調整', () => {
  it('保存失敗では選択を維持し、成功後に通知する', async () => {
    const settings = { getHolidayPreferences: jest.fn().mockResolvedValue({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: false }), setHolidayPreferences: jest.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValue(undefined) };
    const onSaved = jest.fn();
    const { result } = await renderHook(() => useHolidayPreferences({ settings, onSaved }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const next = { version: 1, calendarId: 'none', adjustThisWeekDeadline: true } as const;
    await act(async () => { await result.current.setValue(next); });
    expect(result.current.value.calendarId).toBe('jp');
    expect(onSaved).not.toHaveBeenCalled();
    await act(async () => { await result.current.setValue(next); });
    expect(result.current.value).toEqual(next);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it('読込失敗を再試行し、保存中の連打を止めて画面離脱後も通知する', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    const settings = { getHolidayPreferences: jest.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValue({ version: 1, calendarId: 'jp', adjustThisWeekDeadline: false }), setHolidayPreferences: jest.fn().mockReturnValue(pending) };
    const onSaved = jest.fn();
    const { result, unmount } = await renderHook(() => useHolidayPreferences({ settings, onSaved }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    await act(async () => { await result.current.reload(); });
    let saving!: Promise<boolean>;
    await act(async () => { saving = result.current.setValue({ ...result.current.value, calendarId: 'none' }); void result.current.setValue({ ...result.current.value, adjustThisWeekDeadline: true }); });
    expect(settings.setHolidayPreferences).toHaveBeenCalledTimes(1);
    await unmount();
    resolve(); await saving;
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});

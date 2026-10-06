import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { SettingsRepository } from '@/domain/calendar/repositories';
import { useRelativeDateSettings } from '../use-relative-date-settings';

function repository(): jest.Mocked<SettingsRepository> {
  return {
    getDefaultExactDuration: jest.fn(), setDefaultExactDuration: jest.fn(),
    getUndeterminedFadeMinutes: jest.fn(), getCalendarVisible: jest.fn(), setCalendarVisible: jest.fn(),
    getLastEventEditorTab: jest.fn(), setLastEventEditorTab: jest.fn(),
    getLastCalendarViewMode: jest.fn().mockResolvedValue('twoDay'), setLastCalendarViewMode: jest.fn(),
    getThisWeekDeadlineWeekday: jest.fn().mockResolvedValue(6),
    setThisWeekDeadlineWeekday: jest.fn().mockResolvedValue(undefined),
  };
}

describe('useRelativeDateSettings', () => {
  it('保存済み締切曜日を読み込み成功後だけ更新する', async () => {
    const settings = repository();
    const { result } = await renderHook(() => useRelativeDateSettings({
      settings, now: () => '2026-09-30T12:00:00.000Z',
    }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.weekday).toBe(6);

    await act(async () => { expect(await result.current.setWeekday(7)).toBe(true); });
    expect(result.current.weekday).toBe(7);
    expect(settings.setThisWeekDeadlineWeekday).toHaveBeenCalledWith(7, '2026-09-30T12:00:00.000Z');
  });

  it('保存失敗時は以前の値を維持する', async () => {
    const settings = repository();
    settings.setThisWeekDeadlineWeekday.mockRejectedValue(new Error('failed'));
    const { result } = await renderHook(() => useRelativeDateSettings({ settings }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { expect(await result.current.setWeekday(5)).toBe(false); });
    expect(result.current.weekday).toBe(6);
    expect(result.current.error).toBe('設定を保存できませんでした。もう一度お試しください。');
  });
});

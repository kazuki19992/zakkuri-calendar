import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCalendarDayRequest } from '../use-calendar-day-request';

describe('previewからの対象日要求', () => {
  it('準備完了後に一度だけ適用し、消費後の再描画で巻き戻さない', async () => {
    const showDay = jest.fn().mockResolvedValue(true);
    const clearRequest = jest.fn();
    const { rerender } = await renderHook(({ ready, day }: { ready: boolean; day?: string }) => useCalendarDayRequest({
      day, request: 'request-1', ready, isPeriodLoading: false, showDay, clearRequest,
    }), { initialProps: { ready: false, day: '2026-11-05' } });
    expect(showDay).not.toHaveBeenCalled();
    await rerender({ ready: true, day: '2026-11-05' });
    await waitFor(() => expect(clearRequest).toHaveBeenCalledTimes(1));
    await rerender({ ready: true, day: undefined });
    expect(showDay).toHaveBeenCalledTimes(1);
    expect(showDay).toHaveBeenCalledWith('2026-11-05');
  });

  it('適用中に来た新しい要求を失わず、古い完了で新要求を消さない', async () => {
    let finish!: (value: boolean) => void;
    const showDay = jest.fn().mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; })).mockResolvedValue(true);
    const clearRequest = jest.fn();
    const { rerender } = await renderHook(({ day, request }: { day: string; request: string }) => useCalendarDayRequest({
      day, request, ready: true, isPeriodLoading: false, showDay, clearRequest,
    }), { initialProps: { day: '2026-11-05', request: 'a' } });
    await rerender({ day: '2026-11-06', request: 'b' });
    expect(showDay).toHaveBeenCalledTimes(1);
    expect(clearRequest).not.toHaveBeenCalled();
    await act(async () => finish(true));
    await waitFor(() => expect(showDay).toHaveBeenCalledTimes(2));
    expect(showDay).toHaveBeenLastCalledWith('2026-11-06');
    expect(clearRequest).toHaveBeenCalledTimes(1);
  });

  it('不正日付は適用しない', async () => {
    const showDay = jest.fn();
    await renderHook(() => useCalendarDayRequest({ day: '2026-02-30', request: 'a', ready: true, isPeriodLoading: false, showDay, clearRequest: jest.fn() }));
    expect(showDay).not.toHaveBeenCalled();
  });
});

import { renderHook, waitFor } from '@testing-library/react-native';
import { useSavedCalendarEvent } from '../use-saved-calendar-event';

it('カレンダーが操作可能になってから保存先へ移動する', async () => {
  const event = { id: 'saved', date: '2026-11-23', revision: 1 };
  const showDate = jest.fn().mockResolvedValue(true);
  const { result, rerender } = await renderHook(({ ready }: { ready: boolean }) => useSavedCalendarEvent({
    event, ready, selectedDate: '2026-11-22', showDate,
  }), { initialProps: { ready: false } });

  expect(showDate).not.toHaveBeenCalled();
  await rerender({ ready: true });
  await waitFor(() => expect(result.current).toEqual(event));
  expect(showDate).toHaveBeenCalledWith('2026-11-23');

  await rerender({ ready: false });
  await rerender({ ready: true });
  expect(showDate).toHaveBeenCalledTimes(1);
});

it('すでに選択中の日付の保存結果には日付移動を挟まない', async () => {
  const event = { id: 'saved', date: '2026-11-23', revision: 2 };
  const showDate = jest.fn();
  const { result } = await renderHook(() => useSavedCalendarEvent({
    event, ready: true, selectedDate: event.date, showDate,
  }));
  await waitFor(() => expect(result.current).toEqual(event));
  expect(showDate).not.toHaveBeenCalled();
});

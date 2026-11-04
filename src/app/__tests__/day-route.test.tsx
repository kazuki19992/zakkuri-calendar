import { act, render, screen, userEvent } from '@testing-library/react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import DayRoute from '../calendar/day/[date]';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(), useLocalSearchParams: jest.fn(), useRouter: jest.fn() }));
describe('旧1日URLの互換入口', () => {
  it('有効な日付は既存mainへ履歴を閉じて渡す', async () => {
    const dismissTo = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ dismissTo } as unknown as ReturnType<typeof useRouter>);
    jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-12-31' });
    const view = await render(<DayRoute />);
    // OSの長押しによるpreloadではフォーカスされないため、確定まで何もしない。
    expect(dismissTo).not.toHaveBeenCalled();
    await act(() => jest.mocked(useFocusEffect).mock.calls.at(-1)?.[0]());
    await view.rerender(<DayRoute />);
    await act(() => jest.mocked(useFocusEffect).mock.calls.at(-1)?.[0]());
    expect(dismissTo).toHaveBeenCalledTimes(1);
    expect(dismissTo).toHaveBeenCalledWith({ pathname: '/', params: { day: '2026-12-31', request: expect.any(String) } });
  });
  it('不正日付では遷移せず安全な入口を表示する', async () => {
    const dismissTo = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ dismissTo } as unknown as ReturnType<typeof useRouter>);
    jest.mocked(useLocalSearchParams).mockReturnValue({ date: '2026-02-30' });
    await render(<DayRoute />);
    expect(dismissTo).not.toHaveBeenCalled();
    expect(screen.getByText('日付が正しくありません')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'カレンダーを開く' }));
    expect(dismissTo).toHaveBeenCalledWith('/');
  });
});

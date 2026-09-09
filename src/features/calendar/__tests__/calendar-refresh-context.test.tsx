import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import {
  CalendarRefreshProvider,
  useCalendarRefresh,
} from '../calendar-refresh-context';

jest.mock('@/global.css', () => ({}));

function Wrapper({ children }: PropsWithChildren) {
  return <CalendarRefreshProvider>{children}</CalendarRefreshProvider>;
}

describe('カレンダー再読み込み通知', () => {
  it('変更通知のたびにrevisionを増やす', async () => {
    const { result } = await renderHook(() => useCalendarRefresh(), { wrapper: Wrapper });

    expect(result.current.revision).toBe(0);

    await act(() => result.current.notifyChanged());
    expect(result.current.revision).toBe(1);

    await act(() => result.current.notifyChanged());
    expect(result.current.revision).toBe(2);
  });
});

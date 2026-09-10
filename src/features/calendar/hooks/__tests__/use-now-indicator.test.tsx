import { act, renderHook } from '@testing-library/react-native';
import { useNowIndicator } from '../use-now-indicator';

describe('現在時刻インジケーター', () => {
  afterEach(() => jest.useRealTimers());

  it('現在時刻から0時起点の分数と時:分ラベルを求める', async () => {
    const { result } = await renderHook(() => useNowIndicator(() => new Date(2026, 8, 8, 14, 32)));

    expect(result.current).toEqual({ minutesOfDay: 14 * 60 + 32, label: '14:32' });
  });

  it('1分未満の分もゼロ埋めしたラベルにする', async () => {
    const { result } = await renderHook(() => useNowIndicator(() => new Date(2026, 8, 8, 9, 5)));

    expect(result.current.label).toBe('9:05');
  });

  it('一定間隔で現在時刻を再取得し、経過に応じて値を更新する', async () => {
    jest.useFakeTimers();
    let now = new Date(2026, 8, 8, 14, 32);
    const { result } = await renderHook(() => useNowIndicator(() => now));

    expect(result.current.label).toBe('14:32');

    now = new Date(2026, 8, 8, 14, 33);
    await act(async () => jest.advanceTimersByTime(60_000));

    expect(result.current.label).toBe('14:33');
  });
});

import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
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

  it('表示開始からの経過時間ではなく次の分の境目で更新する', async () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 8, 23, 7, 56, 500) });
    const { result } = await renderHook(() => useNowIndicator());
    expect(result.current.label).toBe('23:07');
    await act(async () => jest.advanceTimersByTime(3_499));
    expect(result.current.label).toBe('23:07');
    await act(async () => jest.advanceTimersByTime(1));
    expect(result.current.label).toBe('23:08');
    await act(async () => jest.advanceTimersByTime(60_000));
    expect(result.current.label).toBe('23:09');
  });

  it('フォアグラウンドへ戻るとタイマーを待たずに現在時刻を読み直す', async () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 8, 23, 7, 20) });
    let notify!: (status: AppStateStatus) => void;
    await jest.spyOn(AppState, 'addEventListener').withImplementation((_type, callback) => {
      notify = callback;
      return { remove: jest.fn() };
    }, async () => {
      const { result } = await renderHook(() => useNowIndicator());
      expect(result.current.label).toBe('23:07');
      jest.setSystemTime(new Date(2026, 8, 9, 9, 12, 59));
      await act(() => notify('active'));
      expect(result.current.label).toBe('9:12');
      await act(async () => jest.advanceTimersByTime(1_000));
      expect(result.current.label).toBe('9:13');
    });
  });

  it('固定時刻の依存を利用して値を更新する', async () => {
    jest.useFakeTimers();
    let now = new Date(2026, 8, 8, 14, 32);
    const { result } = await renderHook(() => useNowIndicator(() => now));

    expect(result.current.label).toBe('14:32');

    now = new Date(2026, 8, 8, 14, 33);
    await act(async () => jest.advanceTimersByTime(60_000));

    expect(result.current.label).toBe('14:33');
  });
});

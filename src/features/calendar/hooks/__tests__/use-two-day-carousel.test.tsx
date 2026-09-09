import { act, renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { useTwoDayCarousel } from '../use-two-day-carousel';

function collectValues(value: Animated.Value): number[] {
  const values: number[] = [];
  value.addListener(({ value: current }) => values.push(current));
  return values;
}

describe('2日ビューの予備列付きスワイプカルーセル', () => {
  afterEach(() => jest.restoreAllMocks());

  it('計測した幅の半分を1列の幅にし、予備列分だけ左へ寄せた基準位置で静止する', async () => {
    const { result } = await renderHook(() =>
      useTwoDayCarousel({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext: jest.fn().mockResolvedValue(true),
        reduceMotion: false,
        bufferDays: 1,
        leadingDate: '2026-09-07',
      }),
    );

    const values = collectValues(result.current.translateX);
    await act(() => result.current.onLayout(390));

    expect(result.current.columnWidth).toBe(195);
    expect(values.at(-1)).toBe(-195);
  });

  it('予備日数2では基準位置が1列分ではなく2列分左へ寄る', async () => {
    const { result } = await renderHook(() =>
      useTwoDayCarousel({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext: jest.fn().mockResolvedValue(true),
        reduceMotion: false,
        bufferDays: 2,
        leadingDate: '2026-09-06',
      }),
    );

    const values = collectValues(result.current.translateX);
    await act(() => result.current.onLayout(390));

    expect(values.at(-1)).toBe(-390);
  });

  it('次へ移動すると、取得済みの予備列を1列分だけジャンプなく連続スライドして見せる', async () => {
    const onNext = jest.fn().mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const { result } = await renderHook(() =>
      useTwoDayCarousel({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext,
        reduceMotion: false,
        bufferDays: 1,
        leadingDate: '2026-09-07',
      }),
    );
    await act(() => result.current.onLayout(390));

    await act(async () => expect(await result.current.moveNext()).toBe(true));

    expect(timing).toHaveBeenCalledWith(
      result.current.translateX,
      expect.objectContaining({ toValue: -390 }),
    );
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('移動確定後、ストリップの先頭日が変わったら瞬時に基準位置へ同期し直す', async () => {
    const onNext = jest.fn().mockResolvedValue(true);
    const { result, rerender } = await renderHook(
      ({ leadingDate }: { leadingDate: string }) =>
        useTwoDayCarousel({
          onPrevious: jest.fn().mockResolvedValue(true),
          onNext,
          reduceMotion: false,
          bufferDays: 1,
          leadingDate,
        }),
      { initialProps: { leadingDate: '2026-09-07' } },
    );
    await act(() => result.current.onLayout(390));
    await act(async () => expect(await result.current.moveNext()).toBe(true));

    const values = collectValues(result.current.translateX);
    await act(async () => rerender({ leadingDate: '2026-09-08' }));

    expect(values.at(-1)).toBe(-195);
  });

  it('前への移動は逆方向に1列分だけスライドする', async () => {
    const onPrevious = jest.fn().mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const { result } = await renderHook(() =>
      useTwoDayCarousel({
        onPrevious,
        onNext: jest.fn().mockResolvedValue(true),
        reduceMotion: false,
        bufferDays: 1,
        leadingDate: '2026-09-07',
      }),
    );
    await act(() => result.current.onLayout(390));

    await act(async () => expect(await result.current.movePrevious()).toBe(true));

    expect(timing).toHaveBeenCalledWith(
      result.current.translateX,
      expect.objectContaining({ toValue: 0 }),
    );
  });

  it('取得に失敗すると基準位置へ戻し、先頭日は変わらない', async () => {
    const onNext = jest.fn().mockResolvedValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    const { result } = await renderHook(() =>
      useTwoDayCarousel({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext,
        reduceMotion: false,
        bufferDays: 1,
        leadingDate: '2026-09-07',
      }),
    );
    await act(() => result.current.onLayout(390));

    await act(async () => expect(await result.current.moveNext()).toBe(false));

    expect(timing).toHaveBeenNthCalledWith(
      1,
      result.current.translateX,
      expect.objectContaining({ toValue: -390 }),
    );
    expect(timing).toHaveBeenNthCalledWith(
      2,
      result.current.translateX,
      expect.objectContaining({ toValue: -195 }),
    );
    expect(result.current.isAnimating).toBe(false);
  });

  it('視差効果を減らす場合はアニメーションせず即座に切り替える', async () => {
    const onNext = jest.fn().mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const { result } = await renderHook(() =>
      useTwoDayCarousel({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext,
        reduceMotion: true,
        bufferDays: 1,
        leadingDate: '2026-09-07',
      }),
    );
    await act(() => result.current.onLayout(390));

    await act(async () => expect(await result.current.moveNext()).toBe(true));

    expect(timing).not.toHaveBeenCalled();
  });

  it('移動処理が保留中の同一tick再入力を拒否する', async () => {
    let resolveNext!: (value: boolean) => void;
    const onNext = jest.fn().mockReturnValue(new Promise<boolean>((resolve) => { resolveNext = resolve; }));
    const { result } = await renderHook(() =>
      useTwoDayCarousel({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext,
        reduceMotion: true,
        bufferDays: 1,
        leadingDate: '2026-09-07',
      }),
    );
    await act(() => result.current.onLayout(390));
    let firstMove!: Promise<boolean>;
    let secondMove!: Promise<boolean>;

    await act(async () => {
      firstMove = result.current.moveNext();
      secondMove = result.current.moveNext();
      await Promise.resolve();
    });

    expect(onNext).toHaveBeenCalledTimes(1);
    await expect(secondMove).resolves.toBe(false);
    await act(async () => resolveNext(true));
    await expect(firstMove).resolves.toBe(true);
  });
});

import { act, renderHook } from '@testing-library/react-native';
import { Animated, PanResponder, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { shouldCaptureTwoDaySwipe, useTwoDayCarousel } from '../use-two-day-carousel';

function collectValues(value: Animated.Value): number[] {
  const values: number[] = [];
  value.addListener(({ value: current }) => values.push(current));
  return values;
}

describe('2日ビューの予備列付きスワイプカルーセル', () => {
  it.each([272, 342, 382])('週表示は幅%sを7等分し1回で7列移動する', async (width) => {
    const timing = jest.spyOn(Animated, 'timing');
    const { result } = await renderHook(() => useTwoDayCarousel({ onPrevious: jest.fn().mockResolvedValue(true),
      onNext: jest.fn().mockResolvedValue(true), reduceMotion: false, bufferDays: 7, visibleDayCount: 7, stepDays: 7, leadingDate: '2026-10-26' }));
    await act(() => result.current.onLayout(width));
    expect(result.current.columnWidth * 7).toBeCloseTo(width);
    await act(async () => { await result.current.moveNext(); });
    expect(timing).toHaveBeenCalledWith(result.current.translateX, expect.objectContaining({ toValue: -2 * width }));
  });
  it('スワイプ捕捉後に2本指へ変わった操作は日移動に確定しない', async () => {
    const create = jest.spyOn(PanResponder, 'create');
    const onNext = jest.fn().mockResolvedValue(true);
    await renderHook(() => useTwoDayCarousel({ onPrevious: jest.fn(), onNext,
      reduceMotion: true, bufferDays: 1, leadingDate: '2026-09-07', visibleDayCount: 1 }));
    const handlers = create.mock.calls[0][0];
    const event = {} as GestureResponderEvent;
    const gesture: PanResponderGestureState = { stateID: 1, moveX: 0, moveY: 0, x0: 0, y0: 0, dx: -100, dy: 0, vx: -1, vy: 0, numberActiveTouches: 1, _accountsForMovesUpTo: 0 };
    await act(() => {
      handlers.onPanResponderGrant?.(event, gesture);
      handlers.onPanResponderMove?.(event, { ...gesture, numberActiveTouches: 2 });
      handlers.onPanResponderRelease?.(event, { ...gesture, numberActiveTouches: 0 });
    });
    expect(onNext).not.toHaveBeenCalled();
  });
  it('1日表示では計測幅全体を1列へ割り当てる', async () => {
    const { result } = await renderHook(() => useTwoDayCarousel({ onPrevious: jest.fn(), onNext: jest.fn(),
      reduceMotion: true, bufferDays: 1, leadingDate: '2026-09-07', visibleDayCount: 1 }));
    await act(() => result.current.onLayout(390));
    expect(result.current.columnWidth).toBe(390);
  });
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

  it('横スワイプは1本指だけを捕捉し、2本指のpinchへ干渉しない', async () => {
    const { result } = await renderHook(() =>
      useTwoDayCarousel({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext: jest.fn().mockResolvedValue(true),
        reduceMotion: false,
        bufferDays: 1,
        leadingDate: '2026-09-07',
      }),
    );
    expect(result.current.panHandlers.onMoveShouldSetResponderCapture).toBeDefined();
    const gesture = { dx: 60, dy: 0, numberActiveTouches: 2 };
    expect(shouldCaptureTwoDaySwipe(gesture, false)).toBe(false);
    expect(shouldCaptureTwoDaySwipe({ ...gesture, numberActiveTouches: 1 }, false)).toBe(true);
  });
});

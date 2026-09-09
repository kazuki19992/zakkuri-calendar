import { act, renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';
import {
  getSwipeDirection,
  useHorizontalSwipeTransition,
} from '../use-horizontal-swipe-transition';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('カレンダーの横スワイプ遷移', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [{ dx: 60, dy: 5, vx: 0 }, 'previous'],
    [{ dx: -60, dy: 5, vx: 0 }, 'next'],
    [{ dx: 10, dy: 2, vx: 0.7 }, 'previous'],
    [{ dx: -10, dy: 2, vx: -0.7 }, 'next'],
    [{ dx: 40, dy: 5, vx: 0.2 }, null],
    [{ dx: 80, dy: 75, vx: 0.8 }, null],
  ] as const)('距離・速度・縦移動から方向を判定する: %o', (gesture, expected) => {
    expect(getSwipeDirection(gesture)).toBe(expected);
  });

  it('次移動に成功すると退場後に反対側から入場させる', async () => {
    const onNext = jest.fn().mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const { result } = await renderHook(() =>
      useHorizontalSwipeTransition({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext,
        reduceMotion: false,
      }),
    );
    await act(() => result.current.onLayout(320));

    await act(async () => expect(await result.current.moveNext()).toBe(true));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(timing).toHaveBeenNthCalledWith(
      1,
      result.current.translateX,
      expect.objectContaining({ toValue: -320 }),
    );
    expect(timing).toHaveBeenNthCalledWith(
      2,
      result.current.translateX,
      expect.objectContaining({ toValue: 0 }),
    );
    expect(result.current.isAnimating).toBe(false);
  });

  it('stepRatioを指定するとその比率分の距離だけ退場・入場させる', async () => {
    const onNext = jest.fn().mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const { result } = await renderHook(() =>
      useHorizontalSwipeTransition({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext,
        reduceMotion: false,
        stepRatio: 0.5,
      }),
    );
    await act(() => result.current.onLayout(320));

    await act(async () => expect(await result.current.moveNext()).toBe(true));

    expect(timing).toHaveBeenNthCalledWith(
      1,
      result.current.translateX,
      expect.objectContaining({ toValue: -160 }),
    );
    expect(timing).toHaveBeenNthCalledWith(
      2,
      result.current.translateX,
      expect.objectContaining({ toValue: 0 }),
    );
  });

  it('stepRatioを省略すると従来通り画面全体分の距離で退場・入場させる', async () => {
    const onPrevious = jest.fn().mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const { result } = await renderHook(() =>
      useHorizontalSwipeTransition({
        onPrevious,
        onNext: jest.fn().mockResolvedValue(true),
        reduceMotion: false,
      }),
    );
    await act(() => result.current.onLayout(320));

    await act(async () => expect(await result.current.movePrevious()).toBe(true));

    expect(timing).toHaveBeenNthCalledWith(
      1,
      result.current.translateX,
      expect.objectContaining({ toValue: 320 }),
    );
  });

  it('入場の瞬間移動は不透明度0で隠してから戻し、スライドインが跳躍して見えないようにする', async () => {
    const onNext = jest.fn().mockResolvedValue(true);
    const { result } = await renderHook(() =>
      useHorizontalSwipeTransition({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext,
        reduceMotion: false,
        stepRatio: 0.5,
      }),
    );
    await act(() => result.current.onLayout(320));
    const opacitySetValue = jest.spyOn(result.current.contentOpacity, 'setValue');
    const positionSetValue = jest.spyOn(result.current.translateX, 'setValue');

    await act(async () => expect(await result.current.moveNext()).toBe(true));

    const hideOrder = opacitySetValue.mock.invocationCallOrder[
      opacitySetValue.mock.calls.findIndex((call) => call[0] === 0)
    ];
    const jumpOrder = positionSetValue.mock.invocationCallOrder[
      positionSetValue.mock.calls.findIndex((call) => call[0] === 160)
    ];
    const showOrder = opacitySetValue.mock.invocationCallOrder[
      opacitySetValue.mock.calls.findLastIndex((call) => call[0] === 1)
    ];
    expect(hideOrder).toBeLessThan(jumpOrder);
    expect(jumpOrder).toBeLessThan(showOrder);
  });

  it('視差効果を減らす場合は不透明度を変えずに即座に切り替える', async () => {
    const onNext = jest.fn().mockResolvedValue(true);
    const { result } = await renderHook(() =>
      useHorizontalSwipeTransition({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext,
        reduceMotion: true,
      }),
    );
    const opacitySetValue = jest.spyOn(result.current.contentOpacity, 'setValue');

    await act(async () => expect(await result.current.moveNext()).toBe(true));

    expect(opacitySetValue).not.toHaveBeenCalledWith(0);
  });

  it('取得失敗時は元位置へ戻し、視差効果を減らす場合はanimationを省略する', async () => {
    const onPrevious = jest.fn().mockResolvedValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    const { result } = await renderHook(() =>
      useHorizontalSwipeTransition({
        onPrevious,
        onNext: jest.fn().mockResolvedValue(true),
        reduceMotion: true,
      }),
    );

    await act(async () => expect(await result.current.movePrevious()).toBe(false));

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(timing).not.toHaveBeenCalled();
    expect(result.current.isAnimating).toBe(false);
  });

  it('移動処理が保留中の同一tick再入力を拒否する', async () => {
    const pending = createDeferred<boolean>();
    const onNext = jest.fn().mockReturnValue(pending.promise);
    const { result } = await renderHook(() =>
      useHorizontalSwipeTransition({
        onPrevious: jest.fn().mockResolvedValue(true),
        onNext,
        reduceMotion: true,
      }),
    );
    let firstMove!: Promise<boolean>;
    let secondMove!: Promise<boolean>;

    await act(async () => {
      firstMove = result.current.moveNext();
      secondMove = result.current.moveNext();
      await Promise.resolve();
    });

    expect(onNext).toHaveBeenCalledTimes(1);
    await expect(secondMove).resolves.toBe(false);
    await act(async () => pending.resolve(true));
    await expect(firstMove).resolves.toBe(true);
  });
});

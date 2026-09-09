import { act, renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';
import {
  getSwipeDirection,
  useHorizontalSwipeTransition,
} from '../use-horizontal-swipe-transition';

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
});

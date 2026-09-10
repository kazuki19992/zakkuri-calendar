import { useCallback, useMemo, useState } from 'react';
import { Animated, PanResponder, type PanResponderInstance } from 'react-native';
import {
  createTransitionGate,
  getSwipeDirection,
  horizontalDominance,
  runAnimation,
  type SwipeDirection,
} from './swipe-gesture';

export type { SwipeDirection };
export { getSwipeDirection };

export type UseHorizontalSwipeTransitionInput = Readonly<{
  onPrevious(): Promise<boolean>;
  onNext(): Promise<boolean>;
  reduceMotion: boolean;
}>;

export type HorizontalSwipeTransition = Readonly<{
  translateX: Animated.Value;
  /**
   * 入場時の瞬間移動(取得完了後の位置合わせ)を隠すための不透明度。
   * 通常は1で、移動直後の一瞬だけ0になる。表示側は`transform`と一緒に
   * `opacity`へ適用し、瞬間移動そのものが画面全体分の跳躍に見えないようにする。
   */
  contentOpacity: Animated.Value;
  panHandlers: PanResponderInstance['panHandlers'];
  movePrevious(): Promise<boolean>;
  moveNext(): Promise<boolean>;
  isAnimating: boolean;
  onLayout(width: number): void;
}>;

export function useHorizontalSwipeTransition(
  input: UseHorizontalSwipeTransitionInput,
): HorizontalSwipeTransition {
  const [translateX] = useState(() => new Animated.Value(0));
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const [width, setWidth] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [transitionGate] = useState(() => createTransitionGate());

  const move = useCallback(
    async (direction: SwipeDirection): Promise<boolean> => {
      if (!transitionGate.tryEnter()) return false;
      setIsAnimating(true);
      const callback = direction === 'previous' ? input.onPrevious : input.onNext;
      const exitPosition = direction === 'previous' ? width : -width;
      try {
        if (!input.reduceMotion) await runAnimation(translateX, exitPosition);
        const succeeded = await callback();
        if (succeeded && !input.reduceMotion) {
          // 取得完了後、新しい内容に合わせて位置を一気に合わせ直す(瞬間移動)。
          // ここで不透明度を0にして間に挟むことで、ブリッジ遅延などにより
          // 瞬間移動そのものが1フレーム描画されても、画面全体分跳んだように
          // 見えず、スライドインは常に見た目通りの距離だけに保たれる。
          contentOpacity.setValue(0);
          translateX.setValue(-exitPosition);
          contentOpacity.setValue(1);
          await runAnimation(translateX, 0);
        } else if (!input.reduceMotion) {
          await runAnimation(translateX, 0);
        } else {
          translateX.setValue(0);
        }
        return succeeded;
      } catch {
        translateX.setValue(0);
        return false;
      } finally {
        transitionGate.leave();
        setIsAnimating(false);
      }
    },
    [contentOpacity, input.onNext, input.onPrevious, input.reduceMotion, transitionGate, translateX, width],
  );

  const movePrevious = useCallback(() => move('previous'), [move]);
  const moveNext = useCallback(() => move('next'), [move]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          !isAnimating &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * horizontalDominance,
        onPanResponderMove: (_, gesture) => {
          if (!isAnimating) translateX.setValue(gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          const direction = getSwipeDirection(gesture);
          if (direction === null) {
            if (input.reduceMotion) translateX.setValue(0);
            else void runAnimation(translateX, 0);
            return;
          }
          void move(direction);
        },
        onPanResponderTerminate: () => {
          if (input.reduceMotion) translateX.setValue(0);
          else void runAnimation(translateX, 0);
        },
      }),
    [input.reduceMotion, isAnimating, move, translateX],
  );

  return {
    translateX,
    contentOpacity,
    panHandlers: panResponder.panHandlers,
    movePrevious,
    moveNext,
    isAnimating,
    onLayout: (width) => {
      setWidth(Math.max(width, 1));
    },
  };
}

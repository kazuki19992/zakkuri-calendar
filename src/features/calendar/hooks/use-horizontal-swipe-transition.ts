import { useCallback, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  type PanResponderGestureState,
  type PanResponderInstance,
} from 'react-native';

export type SwipeDirection = 'previous' | 'next';

type SwipeGesture = Readonly<Pick<PanResponderGestureState, 'dx' | 'dy' | 'vx'>>;

const minimumDistance = 48;
const minimumVelocity = 0.5;
const horizontalDominance = 1.2;

function createTransitionGate() {
  let isEntered = false;
  return {
    tryEnter(): boolean {
      if (isEntered) return false;
      isEntered = true;
      return true;
    },
    leave(): void {
      isEntered = false;
    },
  };
}

export function getSwipeDirection(gesture: SwipeGesture): SwipeDirection | null {
  if (Math.abs(gesture.dx) <= Math.abs(gesture.dy) * horizontalDominance) return null;
  const direction = Math.abs(gesture.dx) >= minimumDistance ? gesture.dx : gesture.vx;
  if (Math.abs(gesture.dx) < minimumDistance && Math.abs(gesture.vx) < minimumVelocity) return null;
  return direction > 0 ? 'previous' : 'next';
}

export type UseHorizontalSwipeTransitionInput = Readonly<{
  onPrevious(): Promise<boolean>;
  onNext(): Promise<boolean>;
  reduceMotion: boolean;
  /**
   * 1回の遷移で退場・入場させる距離を、計測した画面幅に対する比率で指定する。
   * 省略時は1(画面全体)。2日ビューのように1回の移動が画面の一部(1日分)しか
   * 更新しない場合は、その割合(例: 0.5)を指定して、更新範囲と見た目の移動量を一致させる。
   */
  stepRatio?: number;
}>;

export type HorizontalSwipeTransition = Readonly<{
  translateX: Animated.Value;
  panHandlers: PanResponderInstance['panHandlers'];
  movePrevious(): Promise<boolean>;
  moveNext(): Promise<boolean>;
  isAnimating: boolean;
  onLayout(width: number): void;
}>;

function runAnimation(value: Animated.Value, toValue: number): Promise<void> {
  return new Promise((resolve) => {
    Animated.timing(value, {
      toValue,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => resolve());
  });
}

export function useHorizontalSwipeTransition(
  input: UseHorizontalSwipeTransitionInput,
): HorizontalSwipeTransition {
  const [translateX] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [transitionGate] = useState(() => createTransitionGate());
  const stepRatio = input.stepRatio ?? 1;

  const move = useCallback(
    async (direction: SwipeDirection): Promise<boolean> => {
      if (!transitionGate.tryEnter()) return false;
      setIsAnimating(true);
      const callback = direction === 'previous' ? input.onPrevious : input.onNext;
      const stepWidth = width * stepRatio;
      const exitPosition = direction === 'previous' ? stepWidth : -stepWidth;
      try {
        if (!input.reduceMotion) await runAnimation(translateX, exitPosition);
        const succeeded = await callback();
        if (succeeded && !input.reduceMotion) {
          translateX.setValue(-exitPosition);
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
    [input.onNext, input.onPrevious, input.reduceMotion, stepRatio, transitionGate, translateX, width],
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
    panHandlers: panResponder.panHandlers,
    movePrevious,
    moveNext,
    isAnimating,
    onLayout: (width) => {
      setWidth(Math.max(width, 1));
    },
  };
}

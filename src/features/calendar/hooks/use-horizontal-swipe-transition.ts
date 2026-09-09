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

  const move = useCallback(
    async (direction: SwipeDirection): Promise<boolean> => {
      if (isAnimating) return false;
      setIsAnimating(true);
      const callback = direction === 'previous' ? input.onPrevious : input.onNext;
      const exitPosition = direction === 'previous' ? width : -width;
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
        setIsAnimating(false);
      }
    },
    [input.onNext, input.onPrevious, input.reduceMotion, isAnimating, translateX, width],
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

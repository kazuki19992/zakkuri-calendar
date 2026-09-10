import { Animated, Easing, type PanResponderGestureState } from 'react-native';

export type SwipeDirection = 'previous' | 'next';

type SwipeGesture = Readonly<Pick<PanResponderGestureState, 'dx' | 'dy' | 'vx'>>;

export const horizontalDominance = 1.2;

const minimumDistance = 48;
const minimumVelocity = 0.5;

/**
 * 水平移動が垂直移動を上回り、距離・速度の閾値を超えた場合だけ移動方向を返す。
 * `useHorizontalSwipeTransition`・`useTwoDayCarousel`で共通の判定に使う。
 */
export function getSwipeDirection(gesture: SwipeGesture): SwipeDirection | null {
  if (Math.abs(gesture.dx) <= Math.abs(gesture.dy) * horizontalDominance) return null;
  const direction = Math.abs(gesture.dx) >= minimumDistance ? gesture.dx : gesture.vx;
  if (Math.abs(gesture.dx) < minimumDistance && Math.abs(gesture.vx) < minimumVelocity) return null;
  return direction > 0 ? 'previous' : 'next';
}

/**
 * 同時に1回しか移動処理を実行させない簡易ミューテックス。
 * アニメーション中の再入力を拒否するために使う。
 */
export function createTransitionGate() {
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

export function runAnimation(value: Animated.Value, toValue: number): Promise<void> {
  return new Promise((resolve) => {
    Animated.timing(value, {
      toValue,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => resolve());
  });
}

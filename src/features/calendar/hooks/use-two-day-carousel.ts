import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Animated, PanResponder, type PanResponderInstance } from 'react-native';
import {
  createTransitionGate,
  getSwipeDirection,
  horizontalDominance,
  runAnimation,
  type SwipeDirection,
} from './swipe-gesture';

export type UseTwoDayCarouselInput = Readonly<{
  onPrevious(): Promise<boolean>;
  onNext(): Promise<boolean>;
  reduceMotion: boolean;
  /** 表示2日の前後にあらかじめ取得・描画しておく予備列の日数。 */
  bufferDays: number;
  /**
   * 現在描画しているストリップの先頭日。移動が確定してこの値が変わったら、
   * ジャンプではなく瞬時の同期として基準位置へ戻す。
   */
  leadingDate: string;
  visibleDayCount?: 1 | 2 | 7;
  stepDays?: 1 | 7;
  navigationKey?: unknown;
}>;

export type TwoDayCarousel = Readonly<{
  translateX: Animated.Value;
  /** 1列(1日分)の幅。予備列を含めたストリップの各列にそのまま使う。 */
  columnWidth: number;
  panHandlers: PanResponderInstance['panHandlers'];
  movePrevious(): Promise<boolean>;
  moveNext(): Promise<boolean>;
  isAnimating: boolean;
  isDragging: boolean;
  onLayout(width: number): void;
}>;

export function shouldCaptureTwoDaySwipe(
  gesture: Readonly<{ dx: number; dy: number; numberActiveTouches: number }>,
  isAnimating: boolean,
): boolean {
  return gesture.numberActiveTouches === 1 &&
    !isAnimating &&
    Math.abs(gesture.dx) > 8 &&
    Math.abs(gesture.dx) > Math.abs(gesture.dy) * horizontalDominance;
}

// 1本指で捕捉した後でも、2本指になった操作全体をpinchとして扱う。
function createTouchSession() {
  let multiTouch = false;
  let gestureVersion = 0;
  let active = false;
  return {
    reset(version = 0) { multiTouch = false; gestureVersion = version; active = true; },
    isActive() { return active; },
    finish() { active = false; },
    version() { return gestureVersion; },
    observe(count: number) { if (count > 1) multiTouch = true; return multiTouch; },
    isMultiTouch() { return multiTouch; },
  };
}

function createOperationVersion() {
  let version = 0;
  let awaitingCallback = false;
  return {
    current: () => version,
    arm() { awaitingCallback = true; },
    callbackStarted() { awaitingCallback = false; },
    awaitingCallback: () => awaitingCallback,
    invalidate() { version += 1; awaitingCallback = false; },
  };
}

/**
 * 表示2日の前後に予備列を持つストリップを、ジャンプなく連続スライドさせる。
 * 予備列はすでに取得・描画済みのため、移動確定時は基準位置から1列分だけ
 * 滑らかにスライドすればよく、取得完了を待って位置を合わせ直す必要がない。
 * 取得完了後にストリップの先頭日が変わったら、`useLayoutEffect`で描画と
 * 同じタイミングで基準位置へ同期し直し、見た目上の跳躍を防ぐ。
 */
export function useTwoDayCarousel(input: UseTwoDayCarouselInput): TwoDayCarousel {
  const [translateX] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [operation] = useState(createOperationVersion);
  const [transitionGate] = useState(() => createTransitionGate());
  const [touchSession] = useState(createTouchSession);
  const columnWidth = width / (input.visibleDayCount ?? 2);
  const baseOffset = -input.bufferDays * columnWidth;

  // 新しい要求は遅延callbackを無効化する。自分自身の取得開始では予備列を戻さない。
  useLayoutEffect(() => {
    if (!operation.awaitingCallback()) return;
    operation.invalidate();
    translateX.stopAnimation();
    translateX.setValue(baseOffset);
  }, [input.navigationKey, baseOffset, operation, translateX]);

  useLayoutEffect(() => {
    operation.invalidate();
    translateX.stopAnimation();
    translateX.setValue(baseOffset);
    return () => operation.invalidate();
  }, [input.leadingDate, baseOffset, operation, translateX]);

  const move = useCallback(
    async (direction: SwipeDirection): Promise<boolean> => {
      if (!transitionGate.tryEnter()) return false;
      setIsAnimating(true);
      operation.arm();
      const version = operation.current();
      const callback = direction === 'previous' ? input.onPrevious : input.onNext;
      const stepWidth = columnWidth * (input.stepDays ?? 1);
      const target = direction === 'previous' ? baseOffset + stepWidth : baseOffset - stepWidth;
      try {
        if (!input.reduceMotion) await runAnimation(translateX, target);
        else translateX.setValue(target);
        if (version !== operation.current()) return false;
        operation.callbackStarted();
        const succeeded = await callback();
        if (!succeeded && version === operation.current()) {
          // 取得に失敗した場合は先頭日が変わらないため、ここで基準位置へ戻す。
          if (!input.reduceMotion) await runAnimation(translateX, baseOffset);
          else translateX.setValue(baseOffset);
        }
        return succeeded;
      } catch {
        if (version === operation.current()) translateX.setValue(baseOffset);
        return false;
      } finally {
        operation.callbackStarted();
        transitionGate.leave();
        setIsAnimating(false);
      }
    },
    [baseOffset, columnWidth, input.onNext, input.onPrevious, input.reduceMotion, input.stepDays, transitionGate, translateX, operation],
  );

  const movePrevious = useCallback(() => move('previous'), [move]);
  const moveNext = useCallback(() => move('next'), [move]);

  const panResponder = useMemo(
    () => PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) => shouldCaptureTwoDaySwipe(gesture, isAnimating || touchSession.isActive()),
        onPanResponderGrant: () => { touchSession.reset(operation.current()); operation.arm(); setIsDragging(true); },
        onPanResponderStart: (_, gesture) => { touchSession.observe(gesture.numberActiveTouches); },
        onPanResponderMove: (_, gesture) => {
          if (touchSession.version() !== operation.current()) return;
          if (touchSession.observe(gesture.numberActiveTouches)) { translateX.setValue(baseOffset); return; }
          if (!isAnimating) translateX.setValue(baseOffset + gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          if (touchSession.version() !== operation.current()) { touchSession.finish(); setIsDragging(false); return; }
          if (touchSession.isMultiTouch()) { translateX.setValue(baseOffset); operation.callbackStarted(); touchSession.finish(); setIsDragging(false); return; }
          const direction = getSwipeDirection(gesture);
          if (direction === null) {
            if (input.reduceMotion) { translateX.setValue(baseOffset); operation.callbackStarted(); touchSession.finish(); setIsDragging(false); }
            else void runAnimation(translateX, baseOffset).finally(() => { operation.callbackStarted(); touchSession.finish(); setIsDragging(false); });
            return;
          }
          void move(direction);
          touchSession.finish();
          setIsDragging(false);
        },
        onPanResponderTerminate: () => {
          touchSession.finish();
          setIsDragging(false);
          operation.callbackStarted();
          if (touchSession.version() !== operation.current()) return;
          if (input.reduceMotion) translateX.setValue(baseOffset);
          else void runAnimation(translateX, baseOffset);
        },
      }),
    [baseOffset, input.reduceMotion, isAnimating, move, translateX, touchSession, operation],
  );

  return {
    translateX,
    columnWidth,
    panHandlers: panResponder.panHandlers,
    movePrevious,
    moveNext,
    isAnimating,
    isDragging,
    onLayout: (layoutWidth) => {
      setWidth(Math.max(layoutWidth, 1));
    },
  };
}

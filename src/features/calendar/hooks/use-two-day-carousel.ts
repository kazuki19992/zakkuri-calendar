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
}>;

export type TwoDayCarousel = Readonly<{
  translateX: Animated.Value;
  /** 1列(1日分)の幅。予備列を含めたストリップの各列にそのまま使う。 */
  columnWidth: number;
  panHandlers: PanResponderInstance['panHandlers'];
  movePrevious(): Promise<boolean>;
  moveNext(): Promise<boolean>;
  isAnimating: boolean;
  onLayout(width: number): void;
}>;

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
  const [transitionGate] = useState(() => createTransitionGate());
  const columnWidth = width / 2;
  const baseOffset = -input.bufferDays * columnWidth;

  // 計測幅が変わるたび、表示2日がちょうど収まる基準位置へ即座に合わせる。
  useLayoutEffect(() => {
    translateX.setValue(baseOffset);
  }, [baseOffset, translateX]);

  // 移動が確定してストリップの先頭日が変わったら、描画と同じタイミングで
  // 基準位置へ同期する。予備列はすでに正しい内容で描画済みのため、
  // 見た目のピクセルは変わらず、跳躍として見えない。
  useLayoutEffect(() => {
    translateX.setValue(baseOffset);
    // baseOffsetは幅変更時の上のeffectで既に反映されるため、
    // ここではleadingDateの変化だけを検知したい。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.leadingDate]);

  const move = useCallback(
    async (direction: SwipeDirection): Promise<boolean> => {
      if (!transitionGate.tryEnter()) return false;
      setIsAnimating(true);
      const callback = direction === 'previous' ? input.onPrevious : input.onNext;
      const target = direction === 'previous' ? baseOffset + columnWidth : baseOffset - columnWidth;
      try {
        if (!input.reduceMotion) await runAnimation(translateX, target);
        else translateX.setValue(target);
        const succeeded = await callback();
        if (!succeeded) {
          // 取得に失敗した場合は先頭日が変わらないため、ここで基準位置へ戻す。
          if (!input.reduceMotion) await runAnimation(translateX, baseOffset);
          else translateX.setValue(baseOffset);
        }
        return succeeded;
      } catch {
        translateX.setValue(baseOffset);
        return false;
      } finally {
        transitionGate.leave();
        setIsAnimating(false);
      }
    },
    [baseOffset, columnWidth, input.onNext, input.onPrevious, input.reduceMotion, transitionGate, translateX],
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
          if (!isAnimating) translateX.setValue(baseOffset + gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          const direction = getSwipeDirection(gesture);
          if (direction === null) {
            if (input.reduceMotion) translateX.setValue(baseOffset);
            else void runAnimation(translateX, baseOffset);
            return;
          }
          void move(direction);
        },
        onPanResponderTerminate: () => {
          if (input.reduceMotion) translateX.setValue(baseOffset);
          else void runAnimation(translateX, baseOffset);
        },
      }),
    [baseOffset, input.reduceMotion, isAnimating, move, translateX],
  );

  return {
    translateX,
    columnWidth,
    panHandlers: panResponder.panHandlers,
    movePrevious,
    moveNext,
    isAnimating,
    onLayout: (layoutWidth) => {
      setWidth(Math.max(layoutWidth, 1));
    },
  };
}

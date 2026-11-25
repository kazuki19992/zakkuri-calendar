import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export const FOCUSED_TIMELINE_FACTOR = 4;
export const TIMELINE_ZOOM_DURATION = 500;
export type TimelinePreset = 'focused' | 'full';
export type TimelineZoomSelection = Readonly<{ factor: number; preset: TimelinePreset | null }>;
const defaultZoom: TimelineZoomSelection = { factor: FOCUSED_TIMELINE_FACTOR, preset: 'focused' };

export function useTimelinePresetZoom(reduceMotion: boolean, initialZoom = defaultZoom,
  onChange?: (selection: TimelineZoomSelection) => void) {
  const [animation] = useState(() => new Animated.Value(initialZoom.factor));
  const [factor, setFactor] = useState(initialZoom.factor);
  const [preset, setPreset] = useState<TimelinePreset | null>(initialZoom.preset);
  const [isPinching, setPinching] = useState(false);
  const factorRef = useRef(initialZoom.factor);
  const pinchStart = useRef(initialZoom.factor);
  const pinchSelection = useRef<TimelineZoomSelection | null>(null);

  useEffect(() => {
    const listener = animation.addListener(({ value }) => {
      factorRef.current = value;
      setFactor(value);
    });
    return () => {
      animation.removeListener(listener);
      animation.stopAnimation();
    };
  }, [animation]);

  const selectPreset = useCallback((next: TimelinePreset) => {
    const target = next === 'focused' ? FOCUSED_TIMELINE_FACTOR : 1;
    setPreset(next);
    onChange?.({ factor: target, preset: next });
    animation.stopAnimation();
    if (reduceMotion || factorRef.current === target) {
      animation.setValue(target);
      return;
    }
    Animated.timing(animation, {
      toValue: target,
      duration: TIMELINE_ZOOM_DURATION,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
      isInteraction: false,
    }).start();
  }, [animation, onChange, reduceMotion]);

  const beginPinch = useCallback(() => {
    animation.stopAnimation();
    pinchStart.current = factorRef.current;
    pinchSelection.current = null;
    setPinching(true);
  }, [animation]);

  const updatePinch = useCallback((gestureScale: number) => {
    const next = Math.min(FOCUSED_TIMELINE_FACTOR, Math.max(1, pinchStart.current * gestureScale));
    const nextPreset = next === 1 ? 'full' : next === FOCUSED_TIMELINE_FACTOR ? 'focused' : null;
    pinchSelection.current = { factor: next, preset: nextPreset };
    setPreset(nextPreset);
    animation.setValue(next);
  }, [animation]);

  const endPinch = useCallback(() => {
    setPinching(false);
    if (pinchSelection.current === null) return;
    onChange?.(pinchSelection.current);
    pinchSelection.current = null;
  }, [onChange]);

  return { factor, preset, selectPreset, isPinching, beginPinch, updatePinch, endPinch };
}

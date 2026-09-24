import { useCallback, useEffect, useRef, useState } from 'react';

const ACCESSIBILITY_ZOOM_STEP = 0.1;

function normalizeFitScale(fitScale: number): number {
  return Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;
}

/** 24時間fitを下限、等倍を上限とし、fit自体が等倍を超える場合はfitを優先する。 */
export function clampTimelineScale(scale: number, fitScale: number): number {
  const minimum = normalizeFitScale(fitScale);
  const maximum = Math.max(minimum, 1);
  if (!Number.isFinite(scale)) return minimum;
  return Math.min(Math.max(scale, minimum), maximum);
}

export function useTimelineZoom(fitScale: number) {
  const [scale, setScale] = useState(() => clampTimelineScale(fitScale, fitScale));
  const [isPinching, setPinching] = useState(false);
  const scaleRef = useRef(scale);
  const pinchStartScaleRef = useRef(scale);
  const previousFitScaleRef = useRef(fitScale);

  const updateScale = useCallback((next: number | ((current: number) => number)) => {
    setScale((current) => {
      const candidate = typeof next === 'function' ? next(current) : next;
      const clamped = clampTimelineScale(candidate, fitScale);
      scaleRef.current = clamped;
      return clamped;
    });
  }, [fitScale]);

  useEffect(() => {
    const previousMinimum = normalizeFitScale(previousFitScaleRef.current);
    const nextMinimum = normalizeFitScale(fitScale);
    setScale((current) => {
      // 初回計測前の仮fitや回転後の再計測では、利用者が最小倍率にいた場合だけ
      // 新しい24時間fitへ追従する。拡大済みなら新しい境界内で倍率を維持する。
      const next = Math.abs(current - previousMinimum) < 1e-9
        ? nextMinimum
        : clampTimelineScale(current, fitScale);
      scaleRef.current = next;
      return next;
    });
    previousFitScaleRef.current = fitScale;
  }, [fitScale]);

  const beginPinch = useCallback(() => {
    pinchStartScaleRef.current = scaleRef.current;
    setPinching(true);
  }, []);

  const updatePinch = useCallback((factor: number) => {
    updateScale(pinchStartScaleRef.current * factor);
  }, [updateScale]);

  const endPinch = useCallback(() => setPinching(false), []);
  const zoomIn = useCallback(() => updateScale((current) => current + ACCESSIBILITY_ZOOM_STEP), [updateScale]);
  const zoomOut = useCallback(() => updateScale((current) => current - ACCESSIBILITY_ZOOM_STEP), [updateScale]);

  return { scale, isPinching, beginPinch, updatePinch, endPinch, zoomIn, zoomOut } as const;
}

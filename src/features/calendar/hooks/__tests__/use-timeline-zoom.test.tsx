import { act, renderHook } from '@testing-library/react-native';
import { clampTimelineScale, useTimelineZoom } from '../use-timeline-zoom';

describe('2日タイムラインの倍率管理', () => {
  it('24時間fit倍率を下限、等倍を上限として不正値も安全に補正する', () => {
    expect(clampTimelineScale(0.2, 0.4)).toBe(0.4);
    expect(clampTimelineScale(0.7, 0.4)).toBe(0.7);
    expect(clampTimelineScale(1.2, 0.4)).toBe(1);
    expect(clampTimelineScale(1.4, 1.2)).toBe(1.2);
    expect(clampTimelineScale(Number.NaN, 0.4)).toBe(0.4);
  });

  it('pinch開始時の倍率を基準に拡大し、fit倍率変更後も新しい下限未満にしない', async () => {
    const { result, rerender } = await renderHook(
      ({ fit }: { fit: number }) => useTimelineZoom(fit),
      { initialProps: { fit: 0.4 } },
    );

    await act(() => result.current.beginPinch());
    expect(result.current.isPinching).toBe(true);
    await act(() => result.current.updatePinch(2));
    expect(result.current.scale).toBe(0.8);
    await act(() => result.current.endPinch());
    expect(result.current.isPinching).toBe(false);

    await act(() => rerender({ fit: 0.9 }));
    expect(result.current.scale).toBe(0.9);
  });

  it('最小倍率にいる間は画面計測後のfit倍率へ追従する', async () => {
    const { result, rerender } = await renderHook(
      ({ fit }: { fit: number }) => useTimelineZoom(fit),
      { initialProps: { fit: 1 } },
    );

    await act(() => rerender({ fit: 0.4 }));

    expect(result.current.scale).toBe(0.4);
  });

  it('アクセシビリティ操作用の拡大縮小も0.1刻みで境界内に収める', async () => {
    const { result } = await renderHook(() => useTimelineZoom(0.4));

    await act(() => result.current.zoomIn());
    expect(result.current.scale).toBeCloseTo(0.5);
    await act(() => {
      result.current.zoomOut();
      result.current.zoomOut();
    });
    expect(result.current.scale).toBe(0.4);
  });
});

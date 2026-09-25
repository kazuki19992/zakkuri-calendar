import { useCallback, useMemo, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type PanResponderInstance,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNowIndicator } from '../hooks/use-now-indicator';
import { useTimelineZoom } from '../hooks/use-timeline-zoom';
import { TIMELINE_HEIGHT, computeNowLineTop, computeTimelineScale } from '../timeline-layout';
import type { TwoDayViewModel } from '../two-day-view-model';
import { TimelineAxis } from './timeline-axis';
import { TwoDayColumn } from './two-day-column';

export function TwoDayView({
  strip, bufferDays, columnWidth, translateX, panHandlers, onCarouselLayout, now, onEditEvent, onCreateExactAt,
}: Readonly<{
  /** 予備列→表示2日→予備列の順に並んだ日付の並び。 */
  strip: readonly TwoDayViewModel[];
  bufferDays: number;
  /** 1列(1日分)の幅。カルーセルの計測結果をそのまま各列の幅として使う。 */
  columnWidth: number;
  translateX: Animated.Value;
  panHandlers: PanResponderInstance['panHandlers'];
  /** カルーセルが基準位置・スライド距離を計算するための画面幅の計測結果を通知する。 */
  onCarouselLayout(width: number): void;
  onEditEvent?(id: string): void;
  onCreateExactAt?(date: string, startTime: string): void;
  now?: () => Date;
}>) {
  // timelineRowの実測高さ(親から配分された画面の残り高さ)に24時間軸を合わせ、
  // ヘッダーなどを除いた画面内へ縦スクロールなしで収める。
  const [fitScale, setFitScale] = useState(1);
  const zoom = useTimelineZoom(fitScale);
  const { beginPinch, endPinch, updatePinch } = zoom;
  const handleTimelineLayout = useCallback((event: LayoutChangeEvent) => {
    setFitScale(computeTimelineScale(event.nativeEvent.layout.height));
  }, []);
  const pinch = useMemo(() => Gesture.Pinch()
    .runOnJS(true)
    .onBegin(beginPinch)
    .onUpdate((event) => updatePinch(event.scale))
    .onEnd(endPinch)
    .onFinalize(endPinch), [beginPinch, endPinch, updatePinch]);

  // 現在時刻線の位置自体は列に依存せず常に計算できる。列ごとの表示は
  // 各列の`isToday`だけで判断し、予備列が今日でもその列には表示する。
  // 時間軸の現在時刻ラベルだけは、実際に表示している2日(予備列を除く)を
  // 対象にする。
  const visibleDays = strip.slice(bufferDays, bufferDays + 2);
  const indicator = useNowIndicator(now);
  const showsToday = visibleDays.some((day) => day.isToday);
  const nowTop = computeNowLineTop(indicator.minutesOfDay, zoom.scale);

  const stripWidth = strip.length * columnWidth;
  const timelineHeight = TIMELINE_HEIGHT * zoom.scale;
  const isTimelineScrollable = zoom.scale > fitScale + 0.001;

  return (
    <View testID="two-day-calendar" style={styles.container} {...panHandlers}>
      <View testID="two-day-calendar.summary" style={styles.summaryRow}>
        <View style={styles.axisSpacer} />
        <View
          testID="two-day-calendar.day-columns-viewport"
          style={styles.viewport}
          // 時間軸(48pt)を除いた、実際に日付列が占める幅を計測する。ルート全体の
          // 幅を使うと、その分だけ列の幅が広く計算され、右側の列がはみ出してしまう。
          onLayout={(event) => onCarouselLayout(event.nativeEvent.layout.width)}
        >
          <Animated.View testID="two-day-calendar.summary-strip"
            style={[styles.stripRow, { width: stripWidth, transform: [{ translateX }] }]}>
            {strip.map((day) => <TwoDayColumn key={day.date} day={day} onEditEvent={onEditEvent} />)}
          </Animated.View>
        </View>
      </View>
      <View testID="two-day-calendar.timeline" style={styles.timelineViewport} onLayout={handleTimelineLayout}>
        <GestureDetector gesture={pinch}>
          <View collapsable={false} style={styles.fill}>
            <ScrollView testID="two-day-calendar.timeline-scroll" style={styles.fill}
              contentContainerStyle={{ height: timelineHeight }} scrollEnabled={isTimelineScrollable}
              showsVerticalScrollIndicator={isTimelineScrollable} bounces={isTimelineScrollable}>
              <View style={[styles.timelineRow, { height: timelineHeight }]}>
                <View testID="two-day-calendar.timeline-zoom" accessible accessibilityRole="adjustable"
                  accessibilityLabel="0時から24時までの時間軸、表示倍率"
                  accessibilityValue={{ min: Math.round(fitScale * 100), max: Math.round(Math.max(fitScale, 1) * 100), now: Math.round(zoom.scale * 100) }}
                  accessibilityActions={[{ name: 'increment', label: '拡大' }, { name: 'decrement', label: '縮小' }]}
                  onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === 'increment') zoom.zoomIn();
                    if (event.nativeEvent.actionName === 'decrement') zoom.zoomOut();
                  }}>
                  <TimelineAxis scale={zoom.scale} now={showsToday ? { top: nowTop, label: indicator.label } : null} />
                </View>
                <View style={styles.viewport}>
                  <Animated.View testID="two-day-calendar.timeline-strip"
                    style={[styles.stripRow, { width: stripWidth, transform: [{ translateX }] }]}>
                    {strip.map((day) => (
                      <TwoDayColumn key={day.date} day={day} variant="timeline" scale={zoom.scale}
                        onEditEvent={onEditEvent} onCreateExactAt={zoom.isPinching ? undefined : onCreateExactAt}
                        nowTop={day.isToday ? nowTop : null} />
                    ))}
                  </Animated.View>
                </View>
              </View>
            </ScrollView>
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flex: 1 },
  fill: { flex: 1 },
  summaryRow: { flexDirection: 'row', width: '100%' },
  axisSpacer: { width: 48 },
  // 予備列は基準位置から外れた分だけ隠す。表示2日の描画内容自体は変えない。
  viewport: { flex: 1, minWidth: 0, overflow: 'hidden' },
  stripRow: { flexDirection: 'row' },
  timelineViewport: { width: '100%', flex: 1, overflow: 'hidden' },
  timelineRow: { flexDirection: 'row', width: '100%', overflow: 'hidden' },
});

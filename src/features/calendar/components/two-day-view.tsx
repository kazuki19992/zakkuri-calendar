import { useCallback, useState } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type PanResponderInstance,
} from 'react-native';
import { useNowIndicator } from '../hooks/use-now-indicator';
import { computeNowLineTop, computeTimelineScale } from '../timeline-layout';
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
  const [scale, setScale] = useState(1);
  const handleTimelineLayout = useCallback((event: LayoutChangeEvent) => {
    setScale(computeTimelineScale(event.nativeEvent.layout.height));
  }, []);

  // 現在時刻線の位置自体は列に依存せず常に計算できる。列ごとの表示は
  // 各列の`isToday`だけで判断し、予備列が今日でもその列には表示する。
  // 時間軸の現在時刻ラベルだけは、実際に表示している2日(予備列を除く)を
  // 対象にする。
  const visibleDays = strip.slice(bufferDays, bufferDays + 2);
  const indicator = useNowIndicator(now);
  const showsToday = visibleDays.some((day) => day.isToday);
  const nowTop = computeNowLineTop(indicator.minutesOfDay, scale);

  const stripWidth = strip.length * columnWidth;

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
            {strip.map((day) => <TwoDayColumn key={day.date} day={day} />)}
          </Animated.View>
        </View>
      </View>
      <View testID="two-day-calendar.timeline" style={styles.timelineRow} onLayout={handleTimelineLayout}>
        <TimelineAxis scale={scale} now={showsToday ? { top: nowTop, label: indicator.label } : null} />
        <View style={styles.viewport}>
          <Animated.View testID="two-day-calendar.timeline-strip"
            style={[styles.stripRow, { width: stripWidth, transform: [{ translateX }] }]}>
            {strip.map((day) => (
              <TwoDayColumn key={day.date} day={day} variant="timeline" scale={scale} onEditEvent={onEditEvent} onCreateExactAt={onCreateExactAt}
                nowTop={day.isToday ? nowTop : null} />
            ))}
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flex: 1 },
  summaryRow: { flexDirection: 'row', width: '100%' },
  axisSpacer: { width: 48 },
  // 予備列は基準位置から外れた分だけ隠す。表示2日の描画内容自体は変えない。
  viewport: { flex: 1, minWidth: 0, overflow: 'hidden' },
  stripRow: { flexDirection: 'row' },
  timelineRow: { flexDirection: 'row', width: '100%', flex: 1, overflow: 'hidden' },
});

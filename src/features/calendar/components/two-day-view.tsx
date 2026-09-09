import { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useNowIndicator } from '../hooks/use-now-indicator';
import { computeNowLineTop, computeTimelineScale } from '../timeline-layout';
import type { TwoDayViewModel } from '../two-day-view-model';
import { TimelineAxis } from './timeline-axis';
import { TwoDayColumn } from './two-day-column';

export function TwoDayView({ days, onAddEvent, now }: Readonly<{
  days: readonly [TwoDayViewModel, TwoDayViewModel];
  onAddEvent(date: string): void;
  now?: () => Date;
}>) {
  // timelineRowの実測高さ(親から配分された画面の残り高さ)に24時間軸を合わせ、
  // ヘッダーなどを除いた画面内へ縦スクロールなしで収める。
  const [scale, setScale] = useState(1);
  const handleTimelineLayout = useCallback((event: LayoutChangeEvent) => {
    setScale(computeTimelineScale(event.nativeEvent.layout.height));
  }, []);

  // 表示中の2日のどちらかが今日のときだけ、現在時刻線とラベルを表示する。
  const indicator = useNowIndicator(now);
  const showsToday = days.some((day) => day.isToday);
  const nowTop = showsToday ? computeNowLineTop(indicator.minutesOfDay, scale) : null;

  return (
    <View testID="two-day-calendar" style={styles.container}>
      <View testID="two-day-calendar.summary" style={styles.summaryRow}>
        <View style={styles.axisSpacer} />
        {days.map((day) => <TwoDayColumn key={day.date} day={day} onAddEvent={onAddEvent} />)}
      </View>
      <View testID="two-day-calendar.timeline" style={styles.timelineRow} onLayout={handleTimelineLayout}>
        <TimelineAxis scale={scale} now={nowTop !== null ? { top: nowTop, label: indicator.label } : null} />
        <View style={styles.dayLanes}>
          {days.map((day) => (
            <TwoDayColumn key={day.date} day={day} onAddEvent={onAddEvent} variant="timeline" scale={scale}
              nowTop={day.isToday ? nowTop : null} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flex: 1 },
  summaryRow: { flexDirection: 'row', width: '100%' },
  axisSpacer: { width: 48 },
  timelineRow: { flexDirection: 'row', width: '100%', flex: 1, overflow: 'hidden' },
  dayLanes: { flex: 1, flexDirection: 'row', minWidth: 0 },
});

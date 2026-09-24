import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { NOW_LINE_HEIGHT, TIMELINE_HEIGHT, computeHourLineTop } from '../timeline-layout';
import { resolveNearestTimelineHour } from '../timeline-tap-time';
import type { TwoDayViewModel } from '../two-day-view-model';
import { TimelineEventBlock } from './timeline-event-block';

const hourLines = Array.from({ length: 25 }, (_, hour) => hour);

/** 罫線の太さ。位置を下端内へ収める計算とstyleの両方で参照する。 */
const HOUR_LINE_THICKNESS = StyleSheet.hairlineWidth;

export function TwoDayColumn({ day, variant = 'summary', scale = 1, nowTop = null, onEditEvent, onCreateExactAt }: Readonly<{
  day: TwoDayViewModel;
  variant?: 'summary' | 'timeline';
  scale?: number;
  nowTop?: number | null;
  onEditEvent?(id: string): void;
  onCreateExactAt?(date: string, startTime: string): void;
}>) {
  const theme = useTheme();
  const lastTap = useRef<number | null>(null);
  if (variant === 'timeline') {
    return (
      <View
        testID="two-day-calendar.timeline-column"
        style={[styles.timelineColumn, { height: TIMELINE_HEIGHT * scale, borderColor: theme.calendarBorder }]}
        onTouchEnd={(event) => {
          const timestamp = Date.now();
          if (lastTap.current !== null && timestamp - lastTap.current <= 300) {
            onCreateExactAt?.(day.date, resolveNearestTimelineHour(event.nativeEvent.locationY, scale));
            lastTap.current = null;
          } else lastTap.current = timestamp;
        }}
      >
        {day.timelineItems.map((item) => <TimelineEventBlock key={item.id} item={item} scale={scale} onPress={onEditEvent} />)}
        {hourLines.map((hour) => (
          <View
            key={hour}
            testID="two-day-calendar.hour-line"
            // 予定ブロック(zIndex 1)より手前に描画し、予定の背景に隠れて
            // 罫線が見えなくなったり間隔が不揃いに見えたりしないようにする。
            // 表示のみが目的のため、下にある予定へのタップは妨げない。
            pointerEvents="none"
            style={[
              styles.hourLine,
              {
                // 24:00の罫線はtopが列の高さと一致し、そのままでは
                // overflow:'hidden'で線全体がクリップされて見えなくなる。
                // 線の太さ分だけ内側へ寄せ、下端に接する形で描画する。
                // 差し引くのは物理ピクセル1つ分のため、吸着済みの位置は保たれる。
                top: Math.min(
                  computeHourLineTop(hour, scale),
                  TIMELINE_HEIGHT * scale - HOUR_LINE_THICKNESS,
                ),
                backgroundColor: theme.calendarBorder,
              },
            ]}
          />
        ))}
        {nowTop !== null ? (
          <>
            <View
              testID="two-day-calendar.now-line"
              accessible
              accessibilityLabel="現在時刻"
              pointerEvents="none"
              style={[styles.nowLine, { top: nowTop, backgroundColor: theme.calendarNowIndicator }]}
            />
            <View testID="two-day-calendar.now-dot" pointerEvents="none"
              style={[styles.nowDot, { top: nowTop - 3, backgroundColor: theme.calendarNowIndicator }]} />
          </>
        ) : null}
      </View>
    );
  }
  return (
    <View testID="two-day-calendar.column" style={[styles.column, { borderColor: theme.calendarBorder }] }>
      <View accessible accessibilityLabel={day.accessibilityLabel} style={[styles.header, { borderBottomColor: theme.calendarBorder }] }>
        <Text style={[styles.weekday, { color: theme.textSecondary }]}>{day.weekdayLabel}</Text>
        <View testID={day.isToday ? 'two-day-calendar.today-circle' : undefined}
          style={[styles.dateCircle, day.isToday && { backgroundColor: theme.calendarAccent }] }>
          <Text style={[styles.date, { color: day.isToday ? theme.background : theme.text }] }>
            {Number(day.date.slice(8, 10))}
          </Text>
        </View>
        {day.holidayName !== null ? <Text style={[styles.holiday, { color: theme.calendarHoliday }]}>{day.holidayName}</Text>
          : day.holidaySupport === 'unsupported' ? <Text style={[styles.support, { color: theme.textSecondary }]}>祝日情報未対応</Text> : null}
      </View>
      {day.allDayItems.map((item) => (
        <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.accessibilityLabel}
          onPress={() => onEditEvent?.(item.id)}
          style={[styles.item, { borderTopColor: theme.calendarBorder }] }>
          <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
          <Text style={[styles.itemTime, { color: theme.textSecondary }]}>{item.temporalLabel}</Text>
        </Pressable>
      ))}
      {day.allDayItems.length === 0 && day.timelineItems.length === 0
        ? <Text style={[styles.empty, { color: theme.textSecondary }]}>予定はありません</Text>
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, minWidth: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  header: { minHeight: 58, paddingHorizontal: 4, paddingVertical: 3, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  weekday: { fontSize: 11, lineHeight: 14 },
  dateCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  date: { fontSize: 22, fontWeight: '500', lineHeight: 26 },
  holiday: { fontSize: 10, lineHeight: 12 },
  support: { fontSize: 10, lineHeight: 12 },
  empty: { fontSize: 11, paddingHorizontal: 6, paddingVertical: 4 },
  item: { minHeight: 44, paddingHorizontal: 6, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth },
  itemTitle: { fontSize: 12, fontWeight: '500' },
  itemTime: { fontSize: 10, marginTop: 1 },
  timelineColumn: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    borderLeftWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    // 高さ0 + borderTopWidthではなく、実体のある背景色付きの線として描画する。
    // 前者は端末によって描画が不安定になりやすい。
    height: HOUR_LINE_THICKNESS,
    zIndex: 2,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: NOW_LINE_HEIGHT,
    zIndex: 3,
  },
  nowDot: {
    position: 'absolute',
    left: 0,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    zIndex: 4,
  },
});

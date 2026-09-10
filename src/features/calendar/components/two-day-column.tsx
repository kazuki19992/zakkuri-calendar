import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { NOW_LINE_HEIGHT, TIMELINE_HEIGHT, computeHourLineTop } from '../timeline-layout';
import type { TwoDayViewModel } from '../two-day-view-model';
import { TimelineEventBlock } from './timeline-event-block';

const hourLines = Array.from({ length: 25 }, (_, hour) => hour);

/** 罫線の太さ。位置を下端内へ収める計算とstyleの両方で参照する。 */
const HOUR_LINE_THICKNESS = StyleSheet.hairlineWidth;

export function TwoDayColumn({ day, onAddEvent, variant = 'summary', scale = 1, nowTop = null }: Readonly<{
  day: TwoDayViewModel;
  onAddEvent(date: string): void;
  variant?: 'summary' | 'timeline';
  scale?: number;
  nowTop?: number | null;
}>) {
  const theme = useTheme();
  if (variant === 'timeline') {
    return (
      <View
        testID="two-day-calendar.timeline-column"
        style={[styles.timelineColumn, { height: TIMELINE_HEIGHT * scale, borderColor: theme.calendarBorder }]}
      >
        {day.timelineItems.map((item) => <TimelineEventBlock key={item.id} item={item} scale={scale} />)}
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
          <View
            testID="two-day-calendar.now-line"
            accessible
            accessibilityLabel="現在時刻"
            pointerEvents="none"
            style={[styles.nowLine, { top: nowTop, backgroundColor: theme.calendarNowIndicator }]}
          />
        ) : null}
      </View>
    );
  }
  return (
    <View testID="two-day-calendar.column" style={[styles.column, { borderColor: theme.calendarBorder }] }>
      <View accessible accessibilityLabel={day.accessibilityLabel} style={[styles.header, { borderBottomColor: theme.calendarBorder }] }>
        <View style={styles.dateLine}>
          <Text style={[styles.date, { color: theme.text }]}>{day.dateLabel}</Text>
          <Text style={[styles.weekday, { color: theme.textSecondary }]}>（{day.weekdayLabel}）</Text>
          {day.isToday ? <Text style={[styles.today, { color: theme.calendarAccent }]}>今日</Text> : null}
        </View>
        {day.holidayName !== null ? <Text style={[styles.holiday, { color: theme.calendarHoliday }]}>{day.holidayName}</Text>
          : day.holidaySupport === 'unsupported' ? <Text style={[styles.support, { color: theme.textSecondary }]}>祝日情報未対応</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${day.dateLabel}に予定を追加`}
        onPress={() => onAddEvent(day.date)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
        <Text style={[styles.addLabel, { color: theme.calendarAccent }]}>＋ 予定</Text>
      </Pressable>
      {day.allDayItems.map((item) => (
        <View key={item.id} accessible accessibilityLabel={item.accessibilityLabel}
          style={[styles.item, { borderTopColor: theme.calendarBorder }] }>
          <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
          <Text style={[styles.itemTime, { color: theme.textSecondary }]}>{item.temporalLabel}</Text>
        </View>
      ))}
      {day.allDayItems.length === 0 && day.timelineItems.length === 0
        ? <Text style={[styles.empty, { color: theme.textSecondary }]}>予定はありません</Text>
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, minWidth: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  header: { minHeight: 72, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dateLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  date: { fontSize: 17, fontWeight: '700' },
  weekday: { fontSize: 13 },
  today: { fontSize: 12, fontWeight: '700', marginLeft: 6 },
  holiday: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  support: { fontSize: 12, marginTop: 4 },
  addButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  addLabel: { fontSize: 14, fontWeight: '600' },
  empty: { fontSize: 13, padding: 10 },
  item: { minHeight: 52, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemTime: { fontSize: 13, marginTop: 3 },
  pressed: { opacity: 0.6 },
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
});

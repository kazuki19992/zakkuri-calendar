import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { HOUR_HEIGHT, TIMELINE_HEIGHT } from '../timeline-layout';
import type { TwoDayViewModel } from '../two-day-view-model';
import { TimelineEventBlock } from './timeline-event-block';

const hourLines = Array.from({ length: 25 }, (_, hour) => hour);

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
        {hourLines.map((hour) => (
          <View
            key={hour}
            testID="two-day-calendar.hour-line"
            style={[styles.hourLine, { top: hour * HOUR_HEIGHT * scale, borderColor: theme.calendarBorder }]}
          />
        ))}
        {day.timelineItems.map((item) => <TimelineEventBlock key={item.id} item={item} scale={scale} />)}
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    zIndex: 1,
  },
});

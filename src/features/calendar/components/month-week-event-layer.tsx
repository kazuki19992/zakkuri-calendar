import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { getEventColor } from '@/constants/event-colors';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MonthEventSegmentViewModel, MonthWeekViewModel } from '../month-view-model';
import type { SavedCalendarEvent } from '../calendar-refresh-context';

function blockStyle(item: MonthEventSegmentViewModel) {
  return {
    left: `${(item.startWeekday / 7) * 100}%` as const,
    width: `${(item.spanDays / 7) * 100}%` as const,
  };
}

function formatJapaneseDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function withOpacity(color: string, opacity: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
  return color;
}

export function MonthWeekEventLayer({ week, onOpenDay, onEditEvent, savedEvent, headerHeight }: Readonly<{
  week: MonthWeekViewModel;
  headerHeight: number;
  savedEvent?: SavedCalendarEvent | null;
  onOpenDay(date: string): void;
  onEditEvent?(id: string, originalOccurrenceDate?: string): void;
}>) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const hasOverflow = week.days.some((day) => day.hiddenEventCount > 0);

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: headerHeight }]}>
      {[0, 1, 2].map((lane) => (
        <View key={lane} pointerEvents="box-none" style={styles.lane}>
          {week.segments.filter((item) => item.lane === lane).map((item) => {
            const color = item.colorId === null ? theme.calendarEvent : getEventColor(item.colorId, scheme);
            const isOpaque = item.opacityStops.every((stop) => stop.opacity === 1);
            const hasOpaqueEnd = item.alignLabelToEnd && item.opacityStops.at(-1)?.opacity === 1;
            const labelColor = isOpaque || hasOpaqueEnd ? theme.calendarEventText : theme.text;
            const edges = [item.startsInWeek && styles.start, item.endsInWeek && styles.end];
            const testID = `month-calendar.event-block.${item.id}`;
            const isSaved = savedEvent?.id === item.eventId
              && week.days.slice(item.startWeekday, item.startWeekday + item.spanDays).some((day) => day.date === savedEvent.date);
            return (
              <Pressable key={item.id} testID={testID}
                accessibilityRole="button" accessibilityLabel={item.accessibilityLabel}
                onPress={() => item.originalOccurrenceDate === undefined ? onEditEvent?.(item.eventId) : onEditEvent?.(item.eventId, item.originalOccurrenceDate)}
                style={({ pressed }) => [styles.block, blockStyle(item), edges,
                  isOpaque && { backgroundColor: color }, pressed && styles.pressed]}
              >
                {!isOpaque ? <LinearGradient testID={`${testID}.gradient`}
                  accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                  pointerEvents="none"
                  colors={item.opacityStops.map((stop) => withOpacity(color, stop.opacity)) as [string, string, ...string[]]}
                  locations={item.opacityStops.map((stop) => stop.offset) as [number, number, ...number[]]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill}
                /> : null}
                {isSaved ? <View pointerEvents="none" testID={`${testID}.saved`}
                  style={[styles.savedOutline, edges, { borderColor: theme.calendarAccent }]} /> : null}
                <Text numberOfLines={1} style={[
                  styles.label,
                  { color: labelColor },
                  item.alignLabelToEnd && styles.labelAlignEnd,
                ]}>{item.spanDays === 1 ? item.title : `${item.temporalLabel} ${item.title}`}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      {hasOverflow ? (
        <View pointerEvents="box-none" style={styles.lane}>
          {week.days.map((day, index) => day.hiddenEventCount > 0 ? (
            <Pressable key={day.date}
              accessibilityRole="button" accessibilityLabel={`他${day.hiddenEventCount}件、${formatJapaneseDate(day.date)}の予定を開く`}
              onPress={() => onOpenDay(day.date)} style={[styles.more, { left: `${(index / 7) * 100}%` }]}
            >
              <Text numberOfLines={1} style={[styles.moreText, { color: theme.textSecondary }]}>他{day.hiddenEventCount}件</Text>
            </Pressable>
          ) : null)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill },
  lane: { flex: 1, position: 'relative' },
  block: {
    position: 'absolute',
    top: 0,
    bottom: 1,
    maxHeight: 22,
    paddingHorizontal: Spacing.one,
    minWidth: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: { opacity: 0.65 },
  savedOutline: { ...StyleSheet.absoluteFill, borderWidth: 2 },
  start: { borderTopLeftRadius: Radii.small, borderBottomLeftRadius: Radii.small },
  end: { borderTopRightRadius: Radii.small, borderBottomRightRadius: Radii.small },
  label: { fontSize: Typography.caption, fontWeight: '600', lineHeight: 14 },
  labelAlignEnd: { textAlign: 'right' },
  more: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '14.285714%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  moreText: { fontSize: Typography.caption, lineHeight: 12 },
});

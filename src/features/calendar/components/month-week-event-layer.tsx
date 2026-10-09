import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { getEventColor } from '@/constants/event-colors';
import { useTheme } from '@/hooks/use-theme';
import type { MonthEventSegmentViewModel, MonthWeekViewModel } from '../month-view-model';

function blockStyle(item: MonthEventSegmentViewModel) {
  return {
    left: `${(item.startWeekday / 7) * 100}%` as const,
    width: `${(item.spanDays / 7) * 100}%` as const,
    top: `${20 + item.lane * 19}%` as const,
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

export function MonthWeekEventLayer({ week, onOpenDay, onEditEvent }: Readonly<{
  week: MonthWeekViewModel;
  onOpenDay(date: string): void;
  onEditEvent?(id: string, originalOccurrenceDate?: string): void;
}>) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {week.segments.map((item) => {
      const color = getEventColor(item.colorId, scheme);
      return <Pressable key={item.id} testID={`month-calendar.event-block.${item.id}`}
        accessibilityRole="button" accessibilityLabel={item.accessibilityLabel}
        onPress={() => item.originalOccurrenceDate === undefined ? onEditEvent?.(item.eventId) : onEditEvent?.(item.eventId, item.originalOccurrenceDate)}
        hitSlop={11}
        style={[styles.block, blockStyle(item), item.startsInWeek ? styles.start : null, item.endsInWeek ? styles.end : null]}>
        <LinearGradient accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          colors={item.opacityStops.map((stop) => withOpacity(color, stop.opacity)) as [string, string, ...string[]]}
          locations={item.opacityStops.map((stop) => stop.offset) as [number, number, ...number[]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <Text numberOfLines={1} style={[styles.label, { color: theme.background }]}>{item.temporalLabel} {item.title}</Text>
      </Pressable>;
    })}
    {week.days.map((day) => day.hiddenEventCount > 0 ? <Pressable key={day.date}
      accessibilityRole="button" accessibilityLabel={`他${day.hiddenEventCount}件、${formatJapaneseDate(day.date)}の予定を開く`}
      onPress={() => onOpenDay(day.date)} hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }} style={[styles.more, { left: `${(week.days.indexOf(day) / 7) * 100}%` }] }>
      <Text numberOfLines={1} style={[styles.moreText, { color: theme.textSecondary }]}>他{day.hiddenEventCount}件</Text>
    </Pressable> : null)}
  </View>;
}

const styles = StyleSheet.create({
  block: { position: 'absolute', height: 22, paddingHorizontal: 3, justifyContent: 'center', overflow: 'hidden' },
  start: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  end: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  label: { fontSize: 10, fontWeight: '600', lineHeight: 14 },
  more: { position: 'absolute', top: '77%', bottom: 0, width: '14.285714%', justifyContent: 'center', alignItems: 'center' },
  moreText: { fontSize: 10, lineHeight: 12 },
});

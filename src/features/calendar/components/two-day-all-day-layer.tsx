import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getEventColor } from '@/constants/event-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import type { TwoDayAllDayLayout } from '../two-day-view-model';

function withOpacity(color: string, opacity: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
  return color;
}

export function TwoDayAllDayLayer({ layout, columnWidth, height, onEditEvent }: Readonly<{
  layout: TwoDayAllDayLayout;
  columnWidth: number;
  height: number;
  onEditEvent?(id: string, originalOccurrenceDate?: string): void;
}>) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return <View pointerEvents="box-none" style={[styles.layer, { height }]}>
    {layout.segments.map((segment) => {
      const { item } = segment;
      const color = item.colorId === 'holiday'
        ? theme.calendarHolidayBackground
        : getEventColor(item.colorId, scheme);
      const content = <>
        <LinearGradient pointerEvents="none"
          colors={segment.opacityStops.map((stop) => withOpacity(color, stop.opacity)) as [string, string, ...string[]]}
          locations={segment.opacityStops.map((stop) => stop.offset) as [number, number, ...number[]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <Text numberOfLines={1} style={[styles.title, { color: item.colorId === 'holiday' ? theme.calendarHoliday : theme.background }] }>{item.title}</Text>
        <Text numberOfLines={1} style={[styles.time, { color: item.colorId === 'holiday' ? theme.calendarHoliday : theme.background }] }>{item.temporalLabel}</Text>
      </>;
      const style = [styles.segment, {
        left: segment.startIndex * columnWidth + 2,
        width: segment.spanDays * columnWidth - 4,
        top: segment.lane * 44 + 2,
      }, item.colorId === 'holiday' ? {
        backgroundColor: theme.calendarHolidayBackground,
        borderLeftColor: theme.calendarHoliday,
        borderLeftWidth: 3,
      } : null,
      segment.isFuzzyRange ? styles.fuzzy : null,
      segment.isFuzzyRange ? { borderColor: theme.background } : null,
      !segment.startsAtRangeStart ? styles.continuesFromPrevious : null,
      !segment.endsAtRangeEnd ? styles.continuesToNext : null];
      return item.isInteractive ? <Pressable key={segment.id}
        testID={segment.isFuzzyRange ? `two-day-calendar.fuzzy-range.${segment.id}` : `two-day-calendar.all-day-segment.${segment.id}`}
        accessibilityRole="button" accessibilityLabel={item.accessibilityLabel}
        onPress={() => item.eventId === null ? undefined : item.originalOccurrenceDate === undefined
          ? onEditEvent?.(item.eventId)
          : onEditEvent?.(item.eventId, item.originalOccurrenceDate)}
        style={style}>{content}</Pressable>
        : <View key={segment.id} accessible accessibilityRole="text" accessibilityLabel={item.accessibilityLabel} style={style}>{content}</View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 58, left: 0, right: 0 },
  segment: { position: 'absolute', height: 42, borderRadius: 3, paddingHorizontal: 6, justifyContent: 'center', overflow: 'hidden' },
  title: { fontSize: 11, fontWeight: '500' },
  time: { fontSize: 10, marginTop: 1 },
  fuzzy: { borderWidth: 1, borderStyle: 'dashed' },
  continuesFromPrevious: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  continuesToNext: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
});

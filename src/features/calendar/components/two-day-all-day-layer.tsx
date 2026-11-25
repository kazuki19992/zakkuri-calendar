import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getEventColor } from '@/constants/event-colors';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { getTimelineGradientTextStyle } from '../timeline-gradient-text';
import type { TwoDayAllDayLayout } from '../two-day-view-model';

function withOpacity(color: string, opacity: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
  return color;
}

export function TwoDayAllDayLayer({ layout, columnWidth, height, rowHeight, visibleStartIndex, visibleDayCount, top = 58, hideOffscreen = false, onEditEvent, savedEventId, savedDayIndex }: Readonly<{
  layout: TwoDayAllDayLayout;
  columnWidth: number;
  height: number;
  rowHeight: number;
  visibleStartIndex: number;
  visibleDayCount: number;
  top?: number;
  hideOffscreen?: boolean;
  savedEventId?: string;
  savedDayIndex?: number;
  onEditEvent?(id: string, originalOccurrenceDate?: string): void;
}>) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return <View pointerEvents="box-none" style={[styles.layer, { height, top }]}>
    {layout.segments.map((segment) => {
      const { item } = segment;
      const color = item.colorId === 'holiday'
        ? theme.calendarHolidayBackground
        : item.colorId === null ? theme.calendarEvent : getEventColor(item.colorId, scheme);
      const isFaded = item.colorId !== 'holiday' && segment.opacityStops.some((stop) => stop.opacity < 1);
      const overlapsVisibleRange = segment.startIndex < visibleStartIndex + visibleDayCount
        && segment.startIndex + segment.spanDays > visibleStartIndex;
      const labelLeft = overlapsVisibleRange
        ? Math.max(0, visibleStartIndex - segment.startIndex) * columnWidth + 6
        : 6;
      const labelOpacityOffset = (labelLeft + Math.min(columnWidth, 48) / 2) / Math.max(1, segment.spanDays * columnWidth - 4);
      const eventText = item.colorId === null ? theme.calendarEventText : theme.background;
      const textStyle = isFaded
        ? getTimelineGradientTextStyle(segment.opacityStops, labelOpacityOffset, color, theme, eventText)
        : { color: item.colorId === 'holiday' ? theme.calendarHoliday : eventText };
      const highlighted = savedEventId === item.eventId && savedDayIndex !== undefined
        && segment.startIndex <= savedDayIndex && savedDayIndex < segment.startIndex + segment.spanDays;
      const continuedEdges = [
        !segment.startsAtRangeStart && styles.continuesFromPrevious,
        !segment.endsAtRangeEnd && styles.continuesToNext,
      ];
      const testID = segment.isFuzzyRange ? `two-day-calendar.fuzzy-range.${segment.id}` : `two-day-calendar.all-day-segment.${segment.id}`;
      const content = <>
        {isFaded ? <LinearGradient testID={`${testID}.gradient`} pointerEvents="none"
          accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          colors={segment.opacityStops.map((stop) => withOpacity(color, stop.opacity)) as [string, string, ...string[]]}
          locations={segment.opacityStops.map((stop) => stop.offset) as [number, number, ...number[]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
        {highlighted ? <View pointerEvents="none" testID={`two-day-calendar.all-day-segment.${segment.id}.saved`}
          style={[styles.savedOutline, continuedEdges, { borderColor: theme.calendarAccent }]} /> : null}
        <View pointerEvents="none" style={[styles.label, { left: labelLeft }]}>
          <Text numberOfLines={1} maxFontSizeMultiplier={1.5} style={[styles.title, item.kind !== 'holiday' && styles.eventTitle, textStyle]}>{item.title}</Text>
          <Text numberOfLines={1} maxFontSizeMultiplier={1.5} style={[styles.time, textStyle]}>{item.temporalLabel}</Text>
        </View>
      </>;
      const style = [styles.segment, {
        left: segment.startIndex * columnWidth + 2,
        width: Math.max(0, segment.spanDays * columnWidth - 4),
        top: segment.lane * rowHeight + 1,
        height: rowHeight - 2,
      }, !isFaded && { backgroundColor: color },
      segment.isFuzzyRange ? styles.fuzzy : null,
      segment.isFuzzyRange ? { borderColor: theme.background } : null,
      continuedEdges];
      return item.isInteractive && onEditEvent ? <Pressable key={segment.id} testID={testID}
        accessibilityElementsHidden={hideOffscreen && !overlapsVisibleRange} importantForAccessibility={hideOffscreen && !overlapsVisibleRange ? 'no-hide-descendants' : 'auto'}
        accessibilityRole="button" accessibilityLabel={item.accessibilityLabel}
        onPress={() => item.eventId === null ? undefined : item.originalOccurrenceDate === undefined
          ? onEditEvent?.(item.eventId)
          : onEditEvent?.(item.eventId, item.originalOccurrenceDate)}
        style={({ pressed }) => [...style, pressed && styles.pressed]}>{content}</Pressable>
        : <View key={segment.id} testID={testID} accessibilityElementsHidden={hideOffscreen && !overlapsVisibleRange} importantForAccessibility={hideOffscreen && !overlapsVisibleRange ? 'no-hide-descendants' : 'auto'} accessible accessibilityRole="text" accessibilityLabel={item.accessibilityLabel} style={style}>{content}</View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0 },
  segment: { position: 'absolute', borderRadius: Radii.small, paddingHorizontal: Spacing.two, justifyContent: 'center', overflow: 'hidden' },
  pressed: { opacity: 0.65 },
  savedOutline: { ...StyleSheet.absoluteFill, borderWidth: 2, borderRadius: Radii.small },
  title: { fontSize: Typography.caption, includeFontPadding: false },
  eventTitle: { fontWeight: '700' },
  time: { fontSize: Typography.caption, marginTop: Spacing.half, includeFontPadding: false },
  label: { position: 'absolute', top: 1, bottom: 1, right: 2, justifyContent: 'center' },
  fuzzy: { borderWidth: 1, borderStyle: 'dashed' },
  continuesFromPrevious: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  continuesToNext: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
});

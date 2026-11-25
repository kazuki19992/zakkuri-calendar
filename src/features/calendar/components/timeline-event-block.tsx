import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTimelineGradientTextStyle } from '../timeline-gradient-text';
import { getEventColor } from '@/constants/event-colors';
import { Radii, Spacing, Typography } from '@/constants/theme';
import {
  getTimelineItemFrame,
  computePeakOpacityOffset,
  resolveTextAnchor,
  type TimelineItemViewModel,
} from '../timeline-layout';

function withOpacity(hex: string, opacity: number): string {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function TimelineEventBlock({ item, scale = 1, compact = false, highlighted = false, onPress }: Readonly<{
  item: TimelineItemViewModel;
  scale?: number;
  compact?: boolean;
  highlighted?: boolean;
  onPress?(id: string, originalOccurrenceDate?: string): void;
}>) {
  const theme = useTheme();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const eventColor = item.colorId === null ? theme.calendarEvent : getEventColor(item.colorId, colorScheme);
  const width = `${100 / item.overlapCount}%` as const;
  const left = `${item.overlapIndex * (100 / item.overlapCount)}%` as const;
  const { top, height } = getTimelineItemFrame(item, scale);
  const isFaded = item.opacityStops.some((stop) => stop.opacity < 1);
  const continuedEdges = [
    item.continuesFromPreviousDay && styles.continuesFromPreviousDay,
    item.continuesToNextDay && styles.continuesToNextDay,
  ];
  // フェードで両端が薄くなる予定でも、不透明度が最も濃い部分にテキストを寄せて可読性を保つ。
  const peak = computePeakOpacityOffset(item.opacityStops);
  const useTop = (!isFaded && height <= 56) || (compact && peak <= 0.65);
  const textAnchor = useTop ? 'flex-start' : resolveTextAnchor(peak);
  const textOffset = textAnchor === 'flex-start' ? 0.2 : textAnchor === 'flex-end' ? 0.8 : 0.5;
  const textStyle = isFaded
    ? getTimelineGradientTextStyle(item.opacityStops, textOffset, eventColor, theme)
    : { color: theme.calendarEventText };

  const content = (
    <View testID={`timeline-event.${item.id}.card`} style={[
      styles.card,
      // 範囲の端が背景に溶けても、淡い下地で予定の外形を保つ。
      { backgroundColor: isFaded ? withOpacity(eventColor, 0.08) : eventColor },
      continuedEdges,
    ]}>
      {isFaded ? <LinearGradient
        testID={`timeline-event.${item.id}.gradient`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        colors={item.opacityStops.map((stop) => withOpacity(eventColor, stop.opacity)) as [string, string, ...string[]]}
        locations={item.opacityStops.map((stop) => stop.offset) as [number, number, ...number[]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      /> : null}
      {highlighted ? <View testID={`timeline-event.${item.id}.saved`} pointerEvents="none"
        style={[styles.savedOutline, continuedEdges, { borderColor: theme.calendarAccent }]} /> : null}
      {item.isInstant ? <View style={[styles.instantLine, { backgroundColor: eventColor }]} /> : null}
      <View pointerEvents="none" testID={`timeline-event.${item.id}.text`} style={[styles.text, { justifyContent: textAnchor }]}>
        <Text numberOfLines={compact ? 1 : 2} style={[styles.title, textStyle]}>{item.title}</Text>
        <Text numberOfLines={1} style={[styles.time, textStyle]}>{item.temporalLabel}</Text>
      </View>
    </View>
  );
  const location = [styles.position, { top, height, width, left }];
  const accessibility = { accessible: true, accessibilityLabel: item.accessibilityLabel };
  const testID = `timeline-event.${item.id}`;
  if (onPress === undefined) {
    return <View testID={testID} {...accessibility} style={location} onTouchEnd={(event) => event.stopPropagation()}>{content}</View>;
  }
  return (
    <Pressable testID={testID} {...accessibility} accessibilityRole="button"
      style={({ pressed }) => [...location, pressed && styles.pressed]}
      onTouchEnd={(event) => event.stopPropagation()}
      onPress={() => item.originalOccurrenceDate === undefined
        ? onPress(item.eventId) : onPress(item.eventId, item.originalOccurrenceDate)}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute', paddingHorizontal: Spacing.half, zIndex: 1 },
  card: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: Radii.small,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
  },
  continuesFromPreviousDay: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  continuesToNextDay: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  instantLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 2 },
  pressed: { opacity: 0.65 },
  savedOutline: { ...StyleSheet.absoluteFill, borderWidth: 2, borderRadius: Radii.small, zIndex: 1 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: Typography.caption, fontWeight: '700', lineHeight: 14 },
  time: { fontSize: Typography.caption, lineHeight: 12 },
});

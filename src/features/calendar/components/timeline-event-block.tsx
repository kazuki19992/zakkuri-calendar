import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getEventColor } from '@/constants/event-colors';
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

export function TimelineEventBlock({ item, scale = 1, onPress }: Readonly<{
  item: TimelineItemViewModel;
  scale?: number;
  onPress?(id: string, originalOccurrenceDate?: string): void;
}>) {
  const theme = useTheme();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const eventColor = getEventColor(item.colorId, colorScheme);
  const width = `${100 / item.overlapCount}%` as const;
  const left = `${item.overlapIndex * (100 / item.overlapCount)}%` as const;
  const { top, height } = getTimelineItemFrame(item, scale);
  const colors = item.opacityStops.map((stop) =>
    withOpacity(eventColor, stop.opacity),
  ) as unknown as LinearGradientProps['colors'];
  const locations = item.opacityStops.map((stop) => stop.offset) as unknown as readonly [
    number,
    number,
    ...number[],
  ];
  // フェードで両端が薄くなる予定でも、不透明度が最も濃い部分にテキストを寄せて可読性を保つ。
  const textAnchor = resolveTextAnchor(computePeakOpacityOffset(item.opacityStops));

  return (
    <Pressable
      testID={`timeline-event.${item.id}`}
      accessible
      accessibilityLabel={item.accessibilityLabel}
      style={[styles.position, { top, height, width, left }]}
      onTouchEnd={(event) => event.stopPropagation()}
      onPress={() => item.originalOccurrenceDate === undefined
        ? onPress?.(item.eventId)
        : onPress?.(item.eventId, item.originalOccurrenceDate)}
    >
      <View testID={`timeline-event.${item.id}.card`} style={[
        styles.card,
        item.continuesFromPreviousDay ? styles.continuesFromPreviousDay : null,
        item.continuesToNextDay ? styles.continuesToNextDay : null,
      ]}>
        <LinearGradient
          testID={`timeline-event.${item.id}.gradient`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          colors={colors as readonly [ColorValue, ColorValue, ...ColorValue[]]}
          locations={locations}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {item.isInstant ? <View style={[styles.instantLine, { backgroundColor: eventColor }]} /> : null}
        <View testID={`timeline-event.${item.id}.text`} style={[styles.text, { justifyContent: textAnchor }]}>
          <Text numberOfLines={2} style={[styles.title, { color: theme.background, backgroundColor: eventColor }]}>{item.title}</Text>
          <Text numberOfLines={1} style={[styles.time, { color: theme.background, backgroundColor: eventColor }]}>{item.temporalLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute', paddingHorizontal: 2, zIndex: 1 },
  card: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  continuesFromPreviousDay: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  continuesToNextDay: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  instantLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 2 },
  text: { flex: 1 },
  title: { fontSize: 12, fontWeight: '500', lineHeight: 14 },
  time: { fontSize: 10, lineHeight: 12 },
});

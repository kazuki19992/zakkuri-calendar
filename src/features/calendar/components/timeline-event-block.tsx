import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import {
  MIN_EVENT_HEIGHT,
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

export function TimelineEventBlock({ item, scale = 1 }: Readonly<{
  item: TimelineItemViewModel;
  scale?: number;
}>) {
  const theme = useTheme();
  const width = `${100 / item.overlapCount}%` as const;
  const left = `${item.overlapIndex * (100 / item.overlapCount)}%` as const;
  // 縮小後も最小表示高(MIN_EVENT_HEIGHT)を下回らせず、極端な縮尺でも予定を視認・タップできるようにする。
  const top = item.top * scale;
  const height = Math.max(item.height * scale, MIN_EVENT_HEIGHT);
  const colors = item.opacityStops.map((stop) =>
    withOpacity(theme.calendarEvent, stop.opacity),
  ) as unknown as LinearGradientProps['colors'];
  const locations = item.opacityStops.map((stop) => stop.offset) as unknown as readonly [
    number,
    number,
    ...number[],
  ];
  // フェードで両端が薄くなる予定でも、不透明度が最も濃い部分にテキストを寄せて可読性を保つ。
  const textAnchor = resolveTextAnchor(computePeakOpacityOffset(item.opacityStops));

  return (
    <View
      testID={`timeline-event.${item.id}`}
      accessible
      accessibilityLabel={item.accessibilityLabel}
      style={[styles.position, { top, height, width, left }]}
    >
      <View testID={`timeline-event.${item.id}.card`} style={styles.card}>
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
        {item.isInstant ? <View style={[styles.instantLine, { backgroundColor: theme.calendarEventBorder }]} /> : null}
        <View testID={`timeline-event.${item.id}.text`} style={[styles.text, { justifyContent: textAnchor }]}>
          <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>{item.title}</Text>
          <Text numberOfLines={1} style={[styles.time, { color: theme.text }]}>{item.temporalLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute', paddingHorizontal: 2, zIndex: 1 },
  card: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  instantLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 2 },
  text: { flex: 1 },
  title: { fontSize: 12, fontWeight: '600', lineHeight: 15 },
  time: { fontSize: 10, lineHeight: 13 },
});

import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import {
  HOUR_LINE_THICKNESS,
  NOW_LINE_HEIGHT,
  TIMELINE_HEIGHT,
  doesTimelineLabelOverlap,
  getHourLineTop,
  getTimelineAxisLineHeight,
  getTimelineHourLabelOpacity,
} from '../timeline-layout';

const labelHours = Array.from({ length: 25 }, (_, hour) => hour);

export function TimelineAxis({ scale = 1, lineHeight = getTimelineAxisLineHeight(1), now = null }: Readonly<{
  scale?: number;
  lineHeight?: number;
  now?: Readonly<{ top: number; label: string }> | null;
}>) {
  const theme = useTheme();
  const fontSize = 10 * lineHeight / getTimelineAxisLineHeight(1);
  const nowTop = now === null ? null : now.top + (NOW_LINE_HEIGHT - lineHeight) / 2;
  return (
    <View testID="two-day-calendar.timeline-axis" style={[styles.axis, { height: TIMELINE_HEIGHT * scale }]}>
      {labelHours.map((hour) => {
        const top = getHourLineTop(hour, scale) + (HOUR_LINE_THICKNESS - lineHeight) / 2;
        const opacity = getTimelineHourLabelOpacity(hour, scale);
        const overlapsNow = nowTop !== null && doesTimelineLabelOverlap(top, nowTop, lineHeight);
        if (opacity === 0 || overlapsNow) return null;
        return <Text key={hour} accessible={false} allowFontScaling={false}
          testID="two-day-calendar.hour-label"
          style={[styles.label, { top, lineHeight, fontSize, color: theme.textSecondary, opacity }]}>
          {hour}:00
        </Text>;
      })}
      {now !== null ? (
        <Text
          testID="two-day-calendar.now-label"
          accessible
          accessibilityLabel={`現在時刻${now.label}`}
          allowFontScaling={false}
          style={[styles.label, styles.nowLabel, { top: nowTop ?? 0, lineHeight, fontSize, color: theme.calendarNowIndicator }]}
        >
          {now.label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { width: 48, position: 'relative' },
  label: { position: 'absolute', right: 7, includeFontPadding: false },
  nowLabel: { fontWeight: '700', zIndex: 1 },
});

import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import {
  TIMELINE_HEIGHT,
  computeHourLineTop,
  doesTimelineLabelOverlap,
  getTimelineHourLabelOpacity,
} from '../timeline-layout';

const labelHours = Array.from({ length: 25 }, (_, hour) => hour);

export function TimelineAxis({ scale = 1, now = null }: Readonly<{
  scale?: number;
  now?: Readonly<{ top: number; label: string }> | null;
}>) {
  const theme = useTheme();
  return (
    <View
      testID="two-day-calendar.timeline-axis"
      style={[styles.axis, { height: TIMELINE_HEIGHT * scale }]}
    >
      {labelHours.map((hour) => {
        const top = hour === 24
          ? computeHourLineTop(24, scale) - styles.label.lineHeight
          : computeHourLineTop(hour, scale);
        const opacity = getTimelineHourLabelOpacity(hour, scale);
        const isHiddenByNow = now !== null && doesTimelineLabelOverlap(top, now.top, styles.label.lineHeight);
        if (opacity === 0 || isHiddenByNow) return null;
        return (
          <Text
            key={hour}
            testID="two-day-calendar.hour-label"
            accessible={false}
            style={[styles.label, {
            // 24:00は軸の下端と同じ位置になり、そのまま上端基準で置くとラベルが
            // はみ出して見切れるため、行の高さ分だけ上げて下端に揃える。
            // それ以外は罫線と同じ吸着済みの位置を使い、ラベルと罫線を必ず揃える。
            top,
            opacity,
            color: theme.textSecondary,
          }]}
          >
            {hour}:00
          </Text>
        );
      })}
      {now !== null ? (
        <Text
          testID="two-day-calendar.now-label"
          accessibilityLabel={`現在時刻${now.label}`}
          style={[styles.label, styles.nowLabel, { top: now.top, color: theme.calendarNowIndicator }]}
        >
          {now.label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { width: 48, position: 'relative' },
  label: { position: 'absolute', right: 7, fontSize: 10, lineHeight: 13 },
  nowLabel: { fontWeight: '700', zIndex: 1 },
});

import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { HOUR_HEIGHT, TIMELINE_HEIGHT } from '../timeline-layout';

const labelHours = Array.from({ length: 8 }, (_, index) => index * 3);

export function TimelineAxis({ scale = 1, now = null }: Readonly<{
  scale?: number;
  now?: Readonly<{ top: number; label: string }> | null;
}>) {
  const theme = useTheme();
  return (
    <View
      testID="two-day-calendar.timeline-axis"
      accessible
      accessibilityLabel="0時から24時までの時間軸"
      style={[styles.axis, { height: TIMELINE_HEIGHT * scale }]}
    >
      {labelHours.map((hour) => (
        <Text
          key={hour}
          style={[styles.label, { top: hour * HOUR_HEIGHT * scale, color: theme.textSecondary }]}
        >
          {hour}:00
        </Text>
      ))}
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

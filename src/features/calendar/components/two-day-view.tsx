import { StyleSheet, View } from 'react-native';
import type { TwoDayViewModel } from '../two-day-view-model';
import { TimelineAxis } from './timeline-axis';
import { TwoDayColumn } from './two-day-column';

export function TwoDayView({ days, onAddEvent }: Readonly<{
  days: readonly [TwoDayViewModel, TwoDayViewModel];
  onAddEvent(date: string): void;
}>) {
  return (
    <View testID="two-day-calendar" style={styles.container}>
      <View testID="two-day-calendar.summary" style={styles.summaryRow}>
        <View style={styles.axisSpacer} />
        {days.map((day) => <TwoDayColumn key={day.date} day={day} onAddEvent={onAddEvent} />)}
      </View>
      <View testID="two-day-calendar.timeline" style={styles.timelineRow}>
        <TimelineAxis />
        <View style={styles.dayLanes}>
          {days.map((day) => (
            <TwoDayColumn key={day.date} day={day} onAddEvent={onAddEvent} variant="timeline" />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  summaryRow: { flexDirection: 'row', width: '100%' },
  axisSpacer: { width: 48 },
  timelineRow: { flexDirection: 'row', width: '100%' },
  dayLanes: { flex: 1, flexDirection: 'row', minWidth: 0 },
});

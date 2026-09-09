import { StyleSheet, View } from 'react-native';
import type { TwoDayViewModel } from '../two-day-view-model';
import { TwoDayColumn } from './two-day-column';

export function TwoDayView({ days, onAddEvent }: Readonly<{
  days: readonly [TwoDayViewModel, TwoDayViewModel];
  onAddEvent(date: string): void;
}>) {
  return <View testID="two-day-calendar" style={styles.container}>
    {days.map((day) => <TwoDayColumn key={day.date} day={day} onAddEvent={onAddEvent} />)}
  </View>;
}

const styles = StyleSheet.create({ container: { flexDirection: 'row', width: '100%' } });

import DateTimePicker from '@expo/ui/community/datetime-picker';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

function toDate(date: string, time = '00:00'): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}
function dateValue(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function timeValue(value: Date): string { return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`; }

export function EventDateTimeFields({ date, startTime, endTime, disabled, showTimes = true, onDateChange, onStartTimeChange, onEndTimeChange }: Readonly<{
  date: string; startTime: string; endTime: string; disabled: boolean;
  showTimes?: boolean;
  onDateChange(value: string): void; onStartTimeChange(value: string): void; onEndTimeChange(value: string): void;
}>) {
  const theme = useTheme();
  return <View style={styles.fields}>
    <Text style={[styles.label, { color: theme.text }]}>日付</Text>
    <DateTimePicker testID="event-editor.date-picker" mode="date" value={toDate(date)} disabled={disabled} onValueChange={(_, value) => onDateChange(dateValue(value))} />
    {showTimes ? <><Text style={[styles.label, { color: theme.text }]}>開始時刻</Text>
      <DateTimePicker testID="event-editor.start-time-picker" mode="time" value={toDate(date, startTime)} disabled={disabled} is24Hour onValueChange={(_, value) => onStartTimeChange(timeValue(value))} />
      <Text style={[styles.label, { color: theme.text }]}>終了時刻</Text>
      <DateTimePicker testID="event-editor.end-time-picker" mode="time" value={toDate(date, endTime)} disabled={disabled} is24Hour onValueChange={(_, value) => onEndTimeChange(timeValue(value))} />
    </> : null}
  </View>;
}
const styles = StyleSheet.create({ fields: { gap: 8 }, label: { fontSize: 15, fontWeight: '700', marginTop: 16 } });

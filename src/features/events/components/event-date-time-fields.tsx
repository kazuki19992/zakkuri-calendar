import NativeDateTimePicker from '@expo/ui/community/datetime-picker';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { EventEditorTab } from '@/domain/calendar/event';
import { useTheme } from '@/hooks/use-theme';
import { formatEditorDate } from '../event-editor-model';
import { useState } from 'react';

type PickerField = 'startDate' | 'startTime' | 'endDate' | 'endTime' | null;

function toDate(date: string, time = '00:00'): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function dateValue(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function timeValue(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function EventDateTimeFields({
  editorTab,
  isAllDay,
  isDateEditable,
  startDate,
  startTime,
  endDate,
  endTime,
  disabled,
  onAllDayChange,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
}: Readonly<{
  editorTab: EventEditorTab;
  isAllDay: boolean;
  isDateEditable: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  disabled: boolean;
  onAllDayChange(value: boolean): void;
  onStartDateChange(value: string): void;
  onStartTimeChange(value: string): void;
  onEndDateChange(value: string): void;
  onEndTimeChange(value: string): void;
}>) {
  const theme = useTheme();
  const [picker, setPicker] = useState<PickerField>(null);
  const row = (field: Exclude<PickerField, null>, label: string, value: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      accessibilityState={{ disabled: disabled || (field.endsWith('Date') && !isDateEditable) }}
      disabled={disabled || (field.endsWith('Date') && !isDateEditable)}
      onPress={() => setPicker(field)}
      style={[styles.row, { borderBottomColor: theme.calendarBorder }]}
    >
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
    </Pressable>
  );
  const pickerProps = Platform.OS === 'android'
    ? { presentation: 'dialog' as const }
    : { locale: 'ja_JP' };

  return (
    <View style={styles.container}>
      {editorTab === 'exact' ? (
        <View style={[styles.row, { borderBottomColor: theme.calendarBorder }]}>
          <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>終日</Text>
          <Switch accessibilityLabel="終日" accessibilityState={{ checked: isAllDay, disabled }} disabled={disabled} value={isAllDay} onValueChange={onAllDayChange} />
        </View>
      ) : null}
      {row('startDate', editorTab === 'fuzzy' ? '日付' : '開始日', formatEditorDate(startDate))}
      {editorTab === 'exact' && !isAllDay ? row('startTime', '開始時刻', startTime) : null}
      {editorTab === 'exact' ? row('endDate', '終了日', formatEditorDate(endDate)) : null}
      {editorTab === 'exact' && !isAllDay ? row('endTime', '終了時刻', endTime) : null}

      {picker === 'startDate' ? <NativeDateTimePicker {...pickerProps} testID="event-editor.start-date-picker" mode="date" value={toDate(startDate)} disabled={disabled} onValueChange={(_, value) => { onStartDateChange(dateValue(value)); setPicker(null); }} /> : null}
      {picker === 'endDate' ? <NativeDateTimePicker {...pickerProps} testID="event-editor.end-date-picker" mode="date" value={toDate(endDate)} disabled={disabled} onValueChange={(_, value) => { onEndDateChange(dateValue(value)); setPicker(null); }} /> : null}
      {picker === 'startTime' ? <NativeDateTimePicker {...pickerProps} testID="event-editor.start-time-picker" mode="time" value={toDate(startDate, startTime)} disabled={disabled} is24Hour onValueChange={(_, value) => { onStartTimeChange(timeValue(value)); setPicker(null); }} /> : null}
      {picker === 'endTime' ? <NativeDateTimePicker {...pickerProps} testID="event-editor.end-time-picker" mode="time" value={toDate(endDate, endTime)} disabled={disabled} is24Hour onValueChange={(_, value) => { onEndTimeChange(timeValue(value)); setPicker(null); }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 4 },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 16 },
});

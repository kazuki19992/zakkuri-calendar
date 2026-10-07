import NativeDateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { EventEditorTab } from '@/domain/calendar/event';
import { useTheme } from '@/hooks/use-theme';
import { formatEditorDate } from '../event-editor-model';

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
  const timeRow = (field: 'startTime' | 'endTime', label: string, value: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => setPicker(field)}
      style={[styles.row, { borderBottomColor: theme.calendarBorder }]}
    >
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
    </Pressable>
  );
  const dateRow = (
    field: 'startDate' | 'endDate',
    label: string,
    value: string,
    onChange: (next: string) => void,
  ) => {
    const formattedValue = formatEditorDate(value);
    const dateDisabled = disabled || !isDateEditable;
    return (
      <View style={[styles.row, { borderBottomColor: theme.calendarBorder }]}>
        <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
        {Platform.OS === 'ios' && !dateDisabled ? (
          <View style={styles.dateControl}>
            <Text pointerEvents="none"
              style={[styles.rowValue, { color: theme.text }]}>{formattedValue}</Text>
            <NativeDateTimePicker testID={`event-editor.${field === 'startDate'
              ? 'start-date' : 'end-date'}-picker`} mode="date" display="compact"
              value={toDate(value)} locale="ja_JP" style={styles.compactPickerOverlay}
              onValueChange={(_, next) => onChange(dateValue(next))} />
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${formattedValue}`}
            accessibilityState={{ disabled: dateDisabled }} disabled={dateDisabled}
            onPress={() => setPicker(field)} style={styles.dateControl}>
            <Text style={[styles.rowValue, { color: theme.text }]}>{formattedValue}</Text>
          </Pressable>
        )}
      </View>
    );
  };
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
      {dateRow('startDate', editorTab === 'fuzzy' ? '日付' : '開始日', startDate,
        onStartDateChange)}
      {editorTab === 'exact' && !isAllDay ? timeRow('startTime', '開始時刻', startTime) : null}
      {editorTab === 'exact' ? dateRow('endDate', '終了日', endDate, onEndDateChange) : null}
      {editorTab === 'exact' && !isAllDay ? timeRow('endTime', '終了時刻', endTime) : null}

      {Platform.OS !== 'ios' && picker === 'startDate' ? <NativeDateTimePicker
        {...pickerProps} testID="event-editor.start-date-picker" mode="date"
        value={toDate(startDate)} disabled={disabled}
        onDismiss={() => setPicker(null)}
        onValueChange={(_, value) => { onStartDateChange(dateValue(value)); setPicker(null); }} /> : null}
      {Platform.OS !== 'ios' && picker === 'endDate' ? <NativeDateTimePicker
        {...pickerProps} testID="event-editor.end-date-picker" mode="date"
        value={toDate(endDate)} disabled={disabled}
        onDismiss={() => setPicker(null)}
        onValueChange={(_, value) => { onEndDateChange(dateValue(value)); setPicker(null); }} /> : null}
      {picker === 'startTime' ? <NativeDateTimePicker {...pickerProps} testID="event-editor.start-time-picker" mode="time" value={toDate(startDate, startTime)} disabled={disabled} is24Hour onValueChange={(_, value) => { onStartTimeChange(timeValue(value)); setPicker(null); }} /> : null}
      {picker === 'endTime' ? <NativeDateTimePicker {...pickerProps} testID="event-editor.end-time-picker" mode="time" value={toDate(endDate, endTime)} disabled={disabled} is24Hour onValueChange={(_, value) => { onEndTimeChange(timeValue(value)); setPicker(null); }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 0 },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 16 },
  dateControl: { alignItems: 'flex-end', justifyContent: 'center', minHeight: 44,
    minWidth: 136, position: 'relative' },
  compactPickerOverlay: { bottom: 0, left: 0, opacity: 0.01, position: 'absolute',
    right: 0, top: 0 },
});

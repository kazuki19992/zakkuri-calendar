import { Spacing, Typography } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import NativeDateTimePicker from '@expo/ui/community/datetime-picker';
import { useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { EventEditorTab } from '@/domain/calendar/event';
import { toMinutesOfDay, toWallClockTime } from '@/domain/calendar/time';
import { HoursAndMinutesWheels } from '@/shared/components/duration-wheel-picker';
import { useTheme } from '@/hooks/use-theme';
import { formatEditorDate } from '../event-editor-model';

type PickerField = 'startDate' | 'startTime' | 'endDate' | 'endTime' | null;

function toDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateValue(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/**
 * 非fixedでは終了日時を隠すが、終日は終了日を保持して編集できるようにする。
 * 初期長が未確定でも終日切替は許可し、時刻付き入力の操作だけを制限する。
 */
export function EventDateTimeFields({
  editorTab,
  isAllDay,
  isDateEditable,
  startDate,
  startTime,
  endDate,
  endTime,
  disabled,
  showEnd = true,
  durationControl,
  timeInputDisabled = false,
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
  showEnd?: boolean;
  durationControl?: ReactNode;
  timeInputDisabled?: boolean;
  onAllDayChange(value: boolean): void;
  onStartDateChange(value: string): void;
  onStartTimeChange(value: string): void;
  onEndDateChange(value: string): void;
  onEndTimeChange(value: string): void;
}>) {
  const theme = useTheme();
  const showTimes = editorTab === 'exact' && !isAllDay;
  const showEndDate = isAllDay || (showTimes && showEnd);
  const dateTimeDisabled = disabled || (showTimes && timeInputDisabled);
  const [picker, setPicker] = useState<PickerField>(null);
  if ((picker === 'startTime' || picker === 'endTime')
    && (!showTimes || dateTimeDisabled || (picker === 'endTime' && !showEnd))) {
    setPicker(null);
  }

  const timeRow = (field: 'startTime' | 'endTime', label: string, value: string, onChange: (next: string) => void) => {
    const expanded = picker === field && !dateTimeDisabled;
    return (
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${value}`}
          accessibilityState={{ disabled: dateTimeDisabled, expanded }} disabled={dateTimeDisabled}
          onPress={() => { Keyboard.dismiss(); setPicker(expanded ? null : field); }}
          style={[styles.row, { borderBottomColor: theme.calendarBorder }]}>
          <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
          <View style={styles.timeControl}>
            <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
            <SymbolView accessible={false} size={12} tintColor={theme.textSecondary}
              name={expanded ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
                : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} />
          </View>
        </Pressable>
        {expanded ? <HoursAndMinutesWheels
          testID={field === 'startTime' ? 'event-editor.start-time-picker' : 'event-editor.end-time-picker'}
          value={toMinutesOfDay(value) ?? 0} maxHours={23} minuteStep={15} hourUnit="時"
          onChange={(minutes) => {
            const next = toWallClockTime(minutes);
            if (next !== null && next !== value) onChange(next);
          }} /> : null}
      </View>
    );
  };
  const dateRow = (
    field: 'startDate' | 'endDate',
    label: string,
    value: string,
    onChange: (next: string) => void,
  ) => {
    const formattedValue = formatEditorDate(value);
    const dateDisabled = dateTimeDisabled || !isDateEditable;
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
              onValueChange={(_, next) => { setPicker(null); onChange(dateValue(next)); }} />
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${formattedValue}`}
            accessibilityState={{ disabled: dateDisabled }} disabled={dateDisabled}
            onPress={() => { Keyboard.dismiss(); setPicker(field); }} style={styles.dateControl}>
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
      <View style={[styles.row, { borderBottomColor: theme.calendarBorder }]}>
        <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>終日</Text>
        <Switch accessibilityLabel="終日" accessibilityState={{ checked: isAllDay, disabled }}
          disabled={disabled} value={isAllDay}
          trackColor={{ false: theme.calendarBorder, true: theme.calendarAccent }} onValueChange={(value) => {
            Keyboard.dismiss();
            setPicker(null);
            onAllDayChange(value);
          }} />
      </View>
      {dateRow('startDate', isAllDay || showTimes ? '開始日' : '日付', startDate, onStartDateChange)}
      {showTimes ? timeRow('startTime', '開始時刻', startTime, onStartTimeChange) : null}
      {showTimes ? durationControl : null}
      {showEndDate ? dateRow('endDate', '終了日', endDate, onEndDateChange) : null}
      {showTimes && showEnd ? timeRow('endTime', '終了時刻', endTime, onEndTimeChange) : null}

      {Platform.OS !== 'ios' && picker === 'startDate' ? <NativeDateTimePicker
        {...pickerProps} testID="event-editor.start-date-picker" mode="date"
        value={toDate(startDate)} disabled={dateTimeDisabled}
        onDismiss={() => setPicker(null)}
        onValueChange={(_, value) => { onStartDateChange(dateValue(value)); setPicker(null); }} /> : null}
      {Platform.OS !== 'ios' && picker === 'endDate' && showEndDate ? <NativeDateTimePicker
        {...pickerProps} testID="event-editor.end-date-picker" mode="date"
        value={toDate(endDate)} disabled={dateTimeDisabled}
        onDismiss={() => setPicker(null)}
        onValueChange={(_, value) => { onEndDateChange(dateValue(value)); setPicker(null); }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 0 },
  rowLabel: { fontSize: Typography.row },
  rowValue: { fontSize: Typography.row },
  timeControl: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  dateControl: { alignItems: 'flex-end', justifyContent: 'center', minHeight: 44,
    minWidth: 136, position: 'relative' },
  compactPickerOverlay: { bottom: 0, left: 0, opacity: 0.01, position: 'absolute',
    right: 0, top: 0 },
});

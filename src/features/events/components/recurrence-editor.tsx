import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { RecurrenceRuleV1 } from '@/domain/calendar/recurrence';
import { useTheme } from '@/hooks/use-theme';
import type { RecurrenceDraft, RecurrencePreset } from '../event-editor-model';
import { EventSingleSelectField } from './event-single-select-field';

const PRESETS: readonly [RecurrencePreset, string][] = [
  ['none', '繰り返しなし'],
  ['daily', '毎日'],
  ['weekly', '毎週'],
  ['weekdays', '平日'],
  ['monthly', '毎月'],
  ['yearly', '毎年'],
  ['custom', 'カスタム'],
];
const FREQUENCIES: readonly [RecurrenceRuleV1['frequency'], string][] = [
  ['daily', '日'], ['weekly', '週'], ['monthly', '月'], ['yearly', '年'],
];
const WEEKDAYS: readonly [number, string][] = [[0, '日'], [1, '月'], [2, '火'], [3, '水'], [4, '木'], [5, '金'], [6, '土']];
const ENDS: readonly [RecurrenceRuleV1['end']['type'], string][] = [['never', '終了なし'], ['until', '日付まで'], ['count', '回数']];

export function RecurrenceEditor({ draft, disabled, error, onPresetChange, onFrequencyChange, onIntervalChange, onWeekdayToggle, onEndTypeChange, onUntilDateChange, onCountChange }: Readonly<{
  draft: RecurrenceDraft;
  disabled: boolean;
  error: string | null;
  onPresetChange(value: RecurrencePreset): void;
  onFrequencyChange(value: RecurrenceRuleV1['frequency']): void;
  onIntervalChange(value: string): void;
  onWeekdayToggle(value: number): void;
  onEndTypeChange(value: RecurrenceRuleV1['end']['type']): void;
  onUntilDateChange(value: string): void;
  onCountChange(value: string): void;
}>) {
  const theme = useTheme();
  const options = <T extends string,>(items: readonly [T, string][]) =>
    items.map(([value, label]) => ({ value, label }));
  return (
    <View style={styles.container}>
      <EventSingleSelectField label="パターン" value={draft.preset} options={options(PRESETS)}
        disabled={disabled} testID="event-editor.recurrence-preset-picker"
        onChange={onPresetChange} />
      {draft.preset === 'custom' ? (
        <View style={styles.custom}>
          <EventSingleSelectField label="単位" value={draft.frequency}
            options={options(FREQUENCIES)} disabled={disabled}
            testID="event-editor.recurrence-frequency-picker" onChange={onFrequencyChange} />
          <TextInput accessibilityLabel="繰り返し間隔" keyboardType="number-pad" editable={!disabled} value={draft.intervalText} onChangeText={onIntervalChange} style={[styles.input, { borderColor: theme.calendarBorder, color: theme.text }]} />
          {draft.frequency === 'weekly' ? <><Text style={[styles.caption, { color: theme.textSecondary }]}>曜日</Text><View style={styles.choices}>{WEEKDAYS.map(([weekday, label]) => {
            const selected = draft.weekdays.includes(weekday);
            return <Pressable key={weekday} accessibilityRole="button"
              accessibilityLabel={`${label}曜日`} accessibilityState={{ disabled, selected }}
              disabled={disabled} onPress={() => onWeekdayToggle(weekday)} style={[styles.weekday, {
                backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: selected ? theme.calendarAccent : theme.calendarBorder,
              }]}>
              <Text style={{ color: selected ? theme.calendarAccent : theme.text,
                fontWeight: selected ? '700' : '400' }}>{label}</Text>
              {selected ? <View testID={`event-editor.recurrence-weekday-${weekday}-check`}
                style={[styles.checkBadge, { backgroundColor: theme.calendarAccent }]}>
                <Text style={[styles.checkText, { color: theme.background }]}>✓</Text>
              </View> : null}
            </Pressable>;
          })}</View></> : null}
          <EventSingleSelectField label="終了条件" value={draft.endType} options={options(ENDS)}
            disabled={disabled} testID="event-editor.recurrence-end-picker"
            onChange={onEndTypeChange} />
          {draft.endType === 'until' ? <TextInput accessibilityLabel="繰り返し終了日" editable={!disabled} value={draft.untilDate} onChangeText={onUntilDateChange} placeholder="YYYY-MM-DD" placeholderTextColor={theme.textSecondary} style={[styles.input, { borderColor: theme.calendarBorder, color: theme.text }]} /> : null}
          {draft.endType === 'count' ? <TextInput accessibilityLabel="繰り返し回数" keyboardType="number-pad" editable={!disabled} value={draft.countText} onChangeText={onCountChange} style={[styles.input, { borderColor: theme.calendarBorder, color: theme.text }]} /> : null}
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  custom: { gap: 8 },
  caption: { fontSize: 13, marginTop: 4 },
  input: { borderRadius: 8, borderWidth: 1, fontSize: 16, minHeight: 44, paddingHorizontal: 12 },
  weekday: { alignItems: 'center', borderRadius: 22, borderWidth: 2, height: 44,
    justifyContent: 'center', position: 'relative', width: 44 },
  checkBadge: { alignItems: 'center', borderRadius: 8, height: 16, justifyContent: 'center',
    position: 'absolute', right: -4, top: -4, width: 16 },
  checkText: { fontSize: 10, fontWeight: '700', lineHeight: 12 },
});

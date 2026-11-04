import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SingleSelectSheet } from '@/shared/components/single-select-sheet';
import type { HolidayPreferencesState } from '../hooks/use-holiday-preferences';

export function HolidaySettingsSection({ state }: Readonly<{ state: HolidayPreferencesState }>) {
  const theme = useTheme();
  const [selecting, setSelecting] = useState(false);
  const disabled = state.status !== 'ready' || state.isSaving;
  const label = state.value.calendarId === 'jp' ? '日本' : '表示しない';
  return <View style={[styles.section, { borderBottomColor: theme.calendarBorder }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`祝日カレンダー、${label}`} disabled={disabled}
      accessibilityState={{ disabled }} style={styles.row} onPress={() => setSelecting(true)}>
      <Text style={{ color: theme.text }}>祝日カレンダー</Text><Text style={{ color: theme.textSecondary }}>{label} ▾</Text>
    </Pressable>
    <View style={styles.row}>
      <Text style={[styles.switchLabel, { color: theme.text }]}>今週中の締切を土日祝から繰り上げる</Text>
      <Switch accessibilityLabel="今週中の締切を土日祝から繰り上げる" disabled={disabled}
        value={state.value.adjustThisWeekDeadline}
        onValueChange={(adjustThisWeekDeadline) => void state.setValue({ ...state.value, adjustThisWeekDeadline })} />
    </View>
    <Text style={[styles.note, { color: theme.textSecondary }]}>保存済みの予定は変わりません。「今週中」を新しく指定するときに適用されます。</Text>
    {state.value.calendarId === 'none' ? <Text style={[styles.note, { color: theme.textSecondary }]}>祝日を表示せず、締切調整では土日のみを除外します。</Text> : null}
    {state.error ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{state.error}</Text> : null}
    {state.status === 'error' ? <Pressable accessibilityRole="button" accessibilityLabel="祝日設定を再読み込み" style={styles.row}
      onPress={() => void state.reload()}><Text style={{ color: theme.calendarAccent }}>再読み込み</Text></Pressable> : null}
    <SingleSelectSheet visible={selecting} title="祝日カレンダー" value={state.value.calendarId}
      options={[{ value: 'jp', label: '日本' }, { value: 'none', label: '表示しない' }]}
      disabled={disabled} onClose={() => setSelecting(false)} onSelect={(calendarId) => void state.setValue({ ...state.value, calendarId })} />
  </View>;
}
const styles = StyleSheet.create({
  section: { paddingVertical: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchLabel: { flex: 1, flexShrink: 1 }, note: { fontSize: 13 },
});

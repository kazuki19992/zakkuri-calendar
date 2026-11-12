import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SingleSelectSheet } from '@/shared/components/single-select-sheet';
import type { DefaultExactDurationSettingsState } from '../hooks/use-default-exact-duration-settings';
import { defaultExactDurationOptions, exactDurationKey, formatExactDuration } from '../default-exact-duration-model';

/**
 * 候補外の既存固定長も現在値として示し、プリセットへの暗黙の丸めを避ける。
 * 読込み・保存の失敗はこの設定節だけに表示し、他の設定を操作可能に保つ。
 */
export function DefaultExactDurationSettingsSection({ state }: Readonly<{ state: DefaultExactDurationSettingsState }>) {
  const theme = useTheme();
  const [selecting, setSelecting] = useState(false);
  const disabled = state.status !== 'ready' || state.isSaving;
  const label = formatExactDuration(state.value);
  const options = defaultExactDurationOptions(state.value);
  return <View style={[styles.section, { borderBottomColor: theme.calendarBorder }]}>
    <Text style={{ color: theme.textSecondary }}>きっちり予定</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`予定の初期の長さ、${label}`}
      accessibilityState={{ disabled }} disabled={disabled} style={styles.row} onPress={() => setSelecting(true)}>
      <Text style={{ color: theme.text }}>予定の初期の長さ</Text>
      <Text style={{ color: theme.textSecondary }}>{label} ▾</Text>
    </Pressable>
    <Text style={{ color: theme.textSecondary }}>新しく作る予定に使います。保存済みの予定は変わりません。</Text>
    {state.error ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{state.error}</Text> : null}
    {state.status === 'error' ? <Pressable accessibilityRole="button" accessibilityLabel="初期の長さを再読み込み"
      style={styles.row} onPress={() => void state.reload()}><Text style={{ color: theme.calendarAccent }}>再読み込み</Text></Pressable> : null}
    <SingleSelectSheet visible={selecting} title="予定の初期の長さ" value={exactDurationKey(state.value)}
      options={options} disabled={disabled} onClose={() => setSelecting(false)}
      onSelect={(key) => { const option = options.find((item) => item.value === key); if (option) void state.setValue(option.duration); }} />
  </View>;
}
const styles = StyleSheet.create({
  section: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 10, paddingVertical: 20 },
  row: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});

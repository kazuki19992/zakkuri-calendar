import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SettingsRow, settingsListStyles } from './settings-list';
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
  return <View>
    <SettingsRow title="きっちり予定の初期の長さ" value={label}
      description="既存の予定は変わりません。"
      accessibilityLabel={`予定の初期の長さ、${label}`} disabled={disabled} onPress={() => setSelecting(true)} />
    {state.error ? <Text accessibilityRole="alert" style={[settingsListStyles.note, { color: theme.calendarHoliday }]}>{state.error}</Text> : null}
    {state.status === 'error' ? <SettingsRow title="再読み込み" accessibilityLabel="初期の長さを再読み込み"
      onPress={() => { void state.reload(); }} /> : null}
    <SingleSelectSheet visible={selecting} title="予定の初期の長さ" value={exactDurationKey(state.value)}
      options={options} disabled={disabled} onClose={() => setSelecting(false)}
      onSelect={(key) => { const option = options.find((item) => item.value === key); if (option) void state.setValue(option.duration); }} />
  </View>;
}

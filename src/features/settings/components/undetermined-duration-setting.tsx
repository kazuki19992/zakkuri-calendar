import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { DurationWheelPicker } from '@/shared/components/duration-wheel-picker';
import type { useUndeterminedDurationSettings } from '../hooks/use-undetermined-duration-settings';
import { formatMinutes } from '../temporal-preferences-model';
import { SettingsDivider, SettingsRow, settingsListStyles } from './settings-list';

export function UndeterminedDurationSetting({ state, pendingMinutes, onChangeMinutes }: Readonly<{
  state: ReturnType<typeof useUndeterminedDurationSettings>;
  pendingMinutes: number | null;
  onChangeMinutes(value: number | null): void;
}>) {
  const theme = useTheme();
  const [selecting, setSelecting] = useState(false);
  const dirty = pendingMinutes !== null && pendingMinutes !== state.minutes;
  const confirmDuration = (minutes: number) => {
    Alert.alert('未定の表示時間を変更しますか？', `${formatMinutes(state.minutes)} → ${formatMinutes(minutes)}。既存の予定の表示にも反映します。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '保存', onPress: () => { void state.saveMinutes(minutes).then((ok) => { if (ok) onChangeMinutes(null); }); } },
    ]);
  };

  return (
    <>
      <SettingsRow title="終了が未定の予定の表示時間"
        value={state.status === 'ready' ? formatMinutes(pendingMinutes ?? state.minutes) : undefined}
        description="通知や終了時刻には影響しません。"
        onPress={() => setSelecting(true)} disabled={state.status !== 'ready' || state.isSaving} />
      {state.error ? <Text accessibilityRole="alert" style={[settingsListStyles.note, { color: theme.calendarHoliday }]}>
        {state.error}
      </Text> : null}
      {state.status === 'error' ? <SettingsRow title="再読み込み" onPress={() => { void state.reload(); }} /> : null}
      {dirty ? <>
        <SettingsDivider />
        <SettingsRow title="表示時間を保存" onPress={() => confirmDuration(pendingMinutes)} disabled={state.isSaving} />
        <SettingsDivider />
        <SettingsRow title="表示時間の変更を破棄" onPress={() => onChangeMinutes(null)} disabled={state.isSaving} />
      </> : null}
      <DurationWheelPicker visible={selecting} title="未定の表示時間" initialMinutes={pendingMinutes ?? state.minutes}
        maxHours={24} minimumMinutes={1} maximumMinutes={1440} formatValue={formatMinutes}
        onConfirm={(value) => onChangeMinutes(value === state.minutes ? null : value)}
        onClose={() => setSelecting(false)} />
    </>
  );
}

import { Spacing } from '@/constants/theme';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SettingsSwitchRow } from './settings-list';
import type { HolidayPreferencesState } from '../hooks/use-holiday-preferences';

type HolidaySettingProps = Readonly<{ state: HolidayPreferencesState; showError: boolean }>;

export function HolidayDisplaySetting({ state, showError }: HolidaySettingProps) {
  const disabled = state.status !== 'ready' || state.isSaving;
  return (
    <>
      <SettingsSwitchRow title="日本の祝日を表示"
        disabled={disabled} value={state.value.calendarId === 'jp'}
        onValueChange={(shown) => void state.setValue({ ...state.value, calendarId: shown ? 'jp' : 'none' })} />
      {showError ? <HolidaySettingsError state={state} /> : null}
    </>
  );
}

export function DeadlineAdjustmentSetting({ state, showError }: HolidaySettingProps) {
  const disabled = state.status !== 'ready' || state.isSaving;
  return (
    <>
      <SettingsSwitchRow title="締切を直前の平日に繰り上げる"
        description={state.value.calendarId === 'none' ? '祝日を非表示にすると、土日だけ除外します。' : undefined}
        disabled={disabled} value={state.value.adjustThisWeekDeadline}
        onValueChange={(adjustThisWeekDeadline) => void state.setValue({ ...state.value, adjustThisWeekDeadline })} />
      {showError ? <HolidaySettingsError state={state} /> : null}
    </>
  );
}

function HolidaySettingsError({ state }: Readonly<{ state: HolidayPreferencesState }>) {
  const theme = useTheme();
  return (
    <>
      {state.error ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{state.error}</Text> : null}
      {state.status === 'error' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="祝日設定を再読み込み" style={styles.row}
          onPress={() => void state.reload()}>
          <Text style={{ color: theme.calendarAccentText }}>再読み込み</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 54, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.twelve },
});

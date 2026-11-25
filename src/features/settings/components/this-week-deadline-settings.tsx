import { useState } from 'react';
import { Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SingleSelectSheet } from '@/shared/components/single-select-sheet';
import type { HolidayPreferencesState } from '../hooks/use-holiday-preferences';
import type { RelativeDateSettingsState } from '../hooks/use-relative-date-settings';
import { DeadlineAdjustmentSetting } from './holiday-settings-section';
import { SettingsDivider, SettingsGroup, SettingsRow, settingsListStyles } from './settings-list';

const weekdays = [
  { value: 5, label: '金曜日' },
  { value: 6, label: '土曜日' },
  { value: 7, label: '日曜日' },
] as const;

export function ThisWeekDeadlineSettings({ deadline, holidays }: Readonly<{
  deadline: RelativeDateSettingsState;
  holidays: HolidayPreferencesState;
}>) {
  const theme = useTheme();
  const [selecting, setSelecting] = useState(false);
  const disabled = deadline.status !== 'ready' || deadline.isSaving;
  const label = weekdays.find((option) => option.value === deadline.weekday)?.label;

  return (
    <SettingsGroup title="今週中の締切"
      footer="既存の予定の日付は変わりません。">
      <SettingsRow title="締切の曜日" value={deadline.status === 'ready' ? label : undefined} disabled={disabled}
        onPress={() => setSelecting(true)} />
      {deadline.error ? <Text accessibilityRole="alert" style={[settingsListStyles.note, { color: theme.calendarHoliday }]}>
        {deadline.error}
      </Text> : null}
      {deadline.status === 'error' ? <SettingsRow title="再読み込み" onPress={() => { void deadline.reload(); }} /> : null}
      <SettingsDivider />
      <DeadlineAdjustmentSetting state={holidays} showError />
      <SingleSelectSheet visible={selecting} title="締切の曜日" value={deadline.weekday}
        options={weekdays} disabled={disabled}
        onClose={() => setSelecting(false)} onSelect={(value) => { void deadline.setWeekday(value); }} />
    </SettingsGroup>
  );
}

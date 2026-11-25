import { ROUGH_TIME_SETTINGS_TITLE } from '../temporal-preferences-model';
import { Spacing } from '@/constants/theme';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SingleSelectSheet } from '@/shared/components/single-select-sheet';
import { DefaultExactDurationSettingsSection } from '../components/default-exact-duration-settings-section';
import { HolidayDisplaySetting } from '../components/holiday-settings-section';
import { SettingsDivider, SettingsGroup, SettingsListScroll, SettingsRow, settingsListStyles } from '../components/settings-list';
import { UndeterminedDurationSetting } from '../components/undetermined-duration-setting';
import type { DefaultExactDurationSettingsState } from '../hooks/use-default-exact-duration-settings';
import type { HolidayPreferencesState } from '../hooks/use-holiday-preferences';
import type { WeekStartSettingsState } from '../hooks/use-week-start-settings';

export function SettingsScreen({
  onOpenTemporalSettings, onOpenNotificationSettings, notificationStatus, weekStart, holidays, duration, undeterminedDuration, version, backup,
}: Readonly<{
  onOpenTemporalSettings?(): void;
  onOpenNotificationSettings?(): void;
  notificationStatus?: string;
  weekStart: WeekStartSettingsState;
  holidays: HolidayPreferencesState;
  duration: DefaultExactDurationSettingsState;
  undeterminedDuration?: ComponentProps<typeof UndeterminedDurationSetting>;
  version?: string;
  backup?: Readonly<{ isExporting: boolean; error: string | null; exportBackup(): void }>;
}>) {
  const theme = useTheme();
  const [selecting, setSelecting] = useState(false);
  const weekStartDisabled = weekStart.status !== 'ready' || weekStart.isSaving;
  const weekStartLabel = weekStart.value === 1 ? '月曜日' : '日曜日';

  return (
    <SettingsListScroll testID="settings.scroll">
      <SettingsGroup title="カレンダーの表示">
        <SettingsRow title="週の開始曜日" value={weekStartLabel} disabled={weekStartDisabled}
          onPress={() => setSelecting(true)} />
        {weekStart.error ? <Text accessibilityRole="alert" style={[settingsListStyles.note, { color: theme.calendarHoliday }]}>
          {weekStart.error}
        </Text> : null}
        {weekStart.status === 'error' ? <SettingsRow title="再読み込み" accessibilityLabel="週開始設定を再読み込み"
          onPress={() => { void weekStart.reload(); }} /> : null}
        <SettingsDivider />
        <HolidayDisplaySetting state={holidays} showError />
      </SettingsGroup>

      <SettingsGroup title="予定の時間">
        {onOpenTemporalSettings ? <>
          <SettingsRow title={ROUGH_TIME_SETTINGS_TITLE}
            description="ざっくり予定の時間を変更できます。既存の予定にも反映されます。"
            onPress={onOpenTemporalSettings} />
          <SettingsDivider />
        </> : null}
        <DefaultExactDurationSettingsSection state={duration} />
        {undeterminedDuration ? <>
          <SettingsDivider />
          <UndeterminedDurationSetting {...undeterminedDuration} />
        </> : null}
      </SettingsGroup>

      {onOpenNotificationSettings ? <SettingsGroup title="通知">
        <SettingsRow title="通知設定" value={notificationStatus}
          onPress={onOpenNotificationSettings} />
      </SettingsGroup> : null}

      <SettingsGroup title="データ" footer="予定と設定はこの端末に保存されます。">
        {backup ? <>
          <SettingsRow title={backup.isExporting ? '書き出し中…' : 'バックアップを書き出す'}
            disabled={backup.isExporting} onPress={backup.exportBackup} />
          {backup.error ? <Text accessibilityRole="alert" style={[settingsListStyles.note, { color: theme.calendarHoliday }]}>
            {backup.error}
          </Text> : null}
        </> : null}
      </SettingsGroup>

      {version ? <SettingsGroup title="アプリ情報">
        <View style={styles.infoRow}>
          <Text style={{ color: theme.text }}>バージョン</Text>
          <Text style={{ color: theme.textSecondary }}>{version}</Text>
        </View>
      </SettingsGroup> : null}

      <SingleSelectSheet visible={selecting} title="週の開始曜日" value={weekStart.value}
        options={[{ value: 1, label: '月曜日' }, { value: 0, label: '日曜日' }]} disabled={weekStartDisabled}
        onClose={() => setSelecting(false)} onSelect={(value) => { void weekStart.setValue(value); }} />
    </SettingsListScroll>
  );
}

const styles = StyleSheet.create({
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.twelve, minHeight: 44, paddingHorizontal: Spacing.three },
});

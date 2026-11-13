import { NotificationSettingsSection } from '../components/notification-settings-section';
import type { NotificationDefaultsState } from '../hooks/use-notification-defaults';
import type { NotificationRuntime } from '@/features/notifications/notification-context';
import { DefaultExactDurationSettingsSection } from '../components/default-exact-duration-settings-section';
import type { DefaultExactDurationSettingsState } from '../hooks/use-default-exact-duration-settings';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SingleSelectSheet } from '@/shared/components/single-select-sheet';
import type { WeekStartSettingsState } from '../hooks/use-week-start-settings';
import { useTheme } from '@/hooks/use-theme';
import type { RelativeDateSettingsState } from '../hooks/use-relative-date-settings';
import type { HolidayPreferencesState } from '../hooks/use-holiday-preferences';
import { HolidaySettingsSection } from '../components/holiday-settings-section';

const OPTIONS = [[5, '金曜日'], [6, '土曜日'], [7, '日曜日']] as const;

export function SettingsScreen({ onOpenTemporalSettings, state, weekStart, holidays, duration, notificationDefaults, notificationRuntime }: Readonly<{ onOpenTemporalSettings?():void; notificationDefaults?: NotificationDefaultsState; notificationRuntime?: NotificationRuntime; duration: DefaultExactDurationSettingsState; state: RelativeDateSettingsState; weekStart: WeekStartSettingsState; holidays: HolidayPreferencesState }>) {
  const theme = useTheme();
  const [selecting, setSelecting] = useState(false);
  const disabled = weekStart.status !== 'ready' || weekStart.isSaving;
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.root}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>設定</Text>
      <View style={[styles.section, { borderBottomColor: theme.calendarBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>カレンダー</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`週の開始曜日、${weekStart.value === 1 ? '月曜日' : '日曜日'}`}
          accessibilityState={{ disabled }} disabled={disabled} onPress={() => setSelecting(true)} style={styles.settingRow}>
          <Text style={[styles.label, { color: theme.text }]}>週の開始曜日</Text>
          <Text style={{ color: theme.textSecondary }}>{weekStart.value === 1 ? '月曜日' : '日曜日'} ▾</Text>
        </Pressable>
        <Text style={[styles.note, { color: theme.textSecondary }]}>カレンダーの表示順に適用されます。「今週前半」などの期間や、保存済みの予定は変わりません。</Text>
        {weekStart.error ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{weekStart.error}</Text> : null}
        {weekStart.status === 'error' ? <Pressable accessibilityRole="button" accessibilityLabel="週開始設定を再読み込み"
          style={styles.settingRow} onPress={() => void weekStart.reload()}><Text style={{ color: theme.calendarAccent }}>再読み込み</Text></Pressable> : null}
      </View>
      <SingleSelectSheet visible={selecting} title="週の開始曜日" value={weekStart.value}
        options={[{ value: 1, label: '月曜日' }, { value: 0, label: '日曜日' }]} disabled={disabled}
        onClose={() => setSelecting(false)} onSelect={(value) => { void weekStart.setValue(value); }} />
      <HolidaySettingsSection state={holidays} />
      <View style={[styles.section, {borderBottomColor:theme.calendarBorder}]}>
        <Pressable accessibilityRole="button" onPress={onOpenTemporalSettings} style={styles.settingRow}>
          <Text style={[styles.label,{color:theme.text}]}>時間表現</Text><Text style={{color:theme.textSecondary}}>範囲・ぼかし・未定時間 ›</Text>
        </Pressable>
      </View>
      <DefaultExactDurationSettingsSection state={duration} />
      {notificationDefaults && notificationRuntime ? <NotificationSettingsSection defaults={notificationDefaults} runtime={notificationRuntime} /> : null}
      <View style={[styles.section, { borderBottomColor: theme.calendarBorder }]}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ざっくり予定</Text>
        <Text style={[styles.label, { color: theme.text }]}>今週中の締切</Text>
        <View style={styles.options}>{OPTIONS.map(([weekday, label]) => {
          const selected = state.weekday === weekday;
          return <Pressable key={weekday} accessibilityRole="button" accessibilityLabel={label}
            accessibilityState={{ selected, disabled: state.status !== 'ready' || state.isSaving }}
            disabled={state.status !== 'ready' || state.isSaving}
            onPress={() => void state.setWeekday(weekday)}
            style={[styles.option, { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement }]}>
            <Text style={{ color: selected ? theme.calendarAccent : theme.text }}>{selected ? '✓ ' : ''}{label}</Text>
          </Pressable>;
        })}</View>
        <Text style={[styles.note, { color: theme.textSecondary }]}>設定変更は保存済みの予定には影響しません</Text>
        {state.error ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{state.error}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24 },
  heading: { fontSize: 22, fontWeight: '500' },
  section: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 10, paddingVertical: 20 },
  sectionTitle: { fontSize: 13 },
  label: { fontSize: 16 },
  settingRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  note: { fontSize: 13 },
});

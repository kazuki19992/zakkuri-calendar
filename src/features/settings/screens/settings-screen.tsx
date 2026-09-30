import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { RelativeDateSettingsState } from '../hooks/use-relative-date-settings';

const OPTIONS = [[5, '金曜日'], [6, '土曜日'], [7, '日曜日']] as const;

export function SettingsScreen({ state }: Readonly<{ state: RelativeDateSettingsState }>) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>設定</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, paddingVertical: 24 },
  heading: { fontSize: 22, fontWeight: '500' },
  section: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 10, paddingVertical: 20 },
  sectionTitle: { fontSize: 13 },
  label: { fontSize: 16 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  note: { fontSize: 13 },
});

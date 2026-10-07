import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { DurationWheelPicker } from '@/shared/components/duration-wheel-picker';
import type { ReminderDraft } from '../event-editor-model';

const PRESETS = [0, 5, 10, 30, 60, 1_440] as const;

function reminderLabel(minutes: number): string {
  if (minutes === 0) return '予定時刻';
  if (minutes === 1_440) return '1日前';
  if (minutes % 60 === 0) return `${minutes / 60}時間前`;
  return `${minutes}分前`;
}

export function EventReminderEditor({ reminders, disabled, error, onAdd, onRemove, onMove }: Readonly<{
  reminders: readonly ReminderDraft[];
  disabled: boolean;
  error: string | null;
  onAdd(minutesBefore: number): void;
  onRemove(id: string): void;
  onMove(id: string, offset: -1 | 1): void;
}>) {
  const theme = useTheme();
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  return (
    <View style={styles.container}>
      <View style={styles.presets}>
        {PRESETS.map((minutes) => {
          const label = reminderLabel(minutes);
          const added = reminders.some((item) => item.minutesBefore === minutes);
          return (
            <Pressable key={minutes} accessibilityRole="button"
              accessibilityLabel={added ? `${label}は追加済み` : `${label}を追加`}
              accessibilityState={{ disabled: disabled || added, selected: added }}
              disabled={disabled || added} onPress={() => onAdd(minutes)}
              style={[styles.chip, {
                backgroundColor: added ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: added ? theme.calendarAccent : 'transparent',
              }]}>
              <Text style={{ color: added ? theme.calendarAccent : theme.text,
                fontWeight: added ? '700' : '400' }}>{label}</Text>
              {added ? <View testID={`event-editor.reminder-preset-${minutes}-check`}
                style={[styles.checkBadge, { backgroundColor: theme.calendarAccent }]}>
                <Text style={[styles.checkText, { color: theme.background }]}>✓</Text>
              </View> : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="任意の通知時間を追加"
        accessibilityState={{ disabled }} disabled={disabled}
        onPress={() => setCustomPickerOpen(true)}
        style={[styles.customButton, { borderColor: theme.calendarBorder }]}>
        <Text style={{ color: theme.text }}>任意の通知時間</Text>
        <Text style={{ color: theme.calendarAccent }}>選択</Text>
      </Pressable>
      <DurationWheelPicker visible={customPickerOpen} initialMinutes={0} maxHours={23}
        onConfirm={onAdd} onClose={() => setCustomPickerOpen(false)} />
      {reminders.map((reminder, index) => {
        const label = reminderLabel(reminder.minutesBefore);
        return (
          <View key={reminder.id} style={[styles.reminderRow, { borderTopColor: theme.calendarBorder }]}>
            <Text style={[styles.reminderText, { color: theme.text }]}>{label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`${label}を上へ`} disabled={disabled || index === 0} onPress={() => onMove(reminder.id, -1)} style={styles.smallButton}><Text style={{ color: theme.calendarAccent }}>↑</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${label}を下へ`} disabled={disabled || index === reminders.length - 1} onPress={() => onMove(reminder.id, 1)} style={styles.smallButton}><Text style={{ color: theme.calendarAccent }}>↓</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${label}を削除`} disabled={disabled} onPress={() => onRemove(reminder.id)} style={styles.smallButton}><Text style={{ color: theme.calendarHoliday }}>削除</Text></Pressable>
          </View>
        );
      })}
      <Text style={[styles.help, { color: theme.textSecondary }]}>設定は保存されますが、端末への通知はまだ行われません</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 8, borderWidth: 2, justifyContent: 'center', minHeight: 44,
    paddingHorizontal: 10, position: 'relative' },
  checkBadge: { alignItems: 'center', borderRadius: 8, height: 16, justifyContent: 'center',
    position: 'absolute', right: -4, top: -4, width: 16 },
  checkText: { fontSize: 10, fontWeight: '700', lineHeight: 12 },
  customButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  reminderRow: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 48 },
  reminderText: { flex: 1, fontSize: 15 },
  smallButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  help: { fontSize: 13, lineHeight: 18 },
});

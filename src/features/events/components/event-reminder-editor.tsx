import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { getReminderTiming } from '@/domain/calendar/event-reminder';
import {
  defaultReminderTiming,
  editableReminderTiming,
  timingLabel,
  type NotificationCategory,
  type ReminderTiming,
} from '@/domain/notifications/reminder-timing';
import { ReminderTimingPicker } from '@/shared/components/reminder-timing-picker';
import type { ReminderDraft } from '../event-editor-model';
export function EventReminderEditor({
  reminders,
  disabled,
  error,
  onAdd,
  onRemove,
  onMove,
  onUpdate,
  category = 'exact',
  allowEnd = true,
  defaultStatus = 'ready',
  onRetry,
  onReset,
}: Readonly<{
  reminders: readonly ReminderDraft[];
  disabled: boolean;
  error: string | null;
  onAdd(value: number | ReminderTiming): void;
  onRemove(id: string): void;
  onMove(id: string, offset: -1 | 1): void;
  onUpdate?(id: string, value: ReminderTiming): void;
  category?: NotificationCategory;
  allowEnd?: boolean;
  defaultStatus?: 'loading' | 'ready' | 'error';
  onRetry?(): void;
  onReset?(): void;
}>) {
  const theme = useTheme();
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const button = (label: string, action: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      style={styles.button}
    >
      <Text style={{ color: theme.calendarAccent }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 8 }}>
      {defaultStatus === 'loading' ? (
        <Text style={{ color: theme.textSecondary }}>
          通知の初期値を読み込んでいます
        </Text>
      ) : null}
      {defaultStatus === 'error' ? (
        <>
          {
            <Text
              accessibilityRole="alert"
              style={{ color: theme.calendarHoliday }}
            >
              通知の初期値を読み込めませんでした
            </Text>
          }
          {button('通知の初期値を再読み込み', () => onRetry?.())}
        </>
      ) : null}
      {reminders.map((r, index) => (
        <View
          key={r.id}
          style={[styles.row, { borderBottomColor: theme.calendarBorder }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`通知を変更、${timingLabel(getReminderTiming(r), category === 'all_day' || category === 'fuzzy_period')}`}
            disabled={disabled}
            onPress={() => setEditing(r.id)}
            style={[styles.button, { flex: 1 }]}
          >
            <Text style={{ color: theme.text }}>
              {timingLabel(
                getReminderTiming(r),
                category === 'all_day' || category === 'fuzzy_period',
              )}
            </Text>
          </Pressable>
          {index > 0 ? button('上へ', () => onMove(r.id, -1)) : null}
          {button(`通知${index + 1}を削除`, () => onRemove(r.id))}
        </View>
      ))}
      {reminders.length === 0 ? (
        <Text style={{ color: theme.textSecondary }}>通知なし</Text>
      ) : null}
      {button('通知を追加', () => setEditing(null))}
      {error ? (
        <>
          <Text
            accessibilityRole="alert"
            style={{ color: theme.calendarHoliday }}
          >
            {error}
          </Text>
          {button('この種類の初期値に置き換える', () => onReset?.())}
        </>
      ) : null}
      <ReminderTimingPicker
        visible={editing !== undefined}
        allowEnd={allowEnd}
        value={editableReminderTiming(
          editing
            ? getReminderTiming(
                reminders.find((r) => r.id === editing) ?? { minutesBefore: 0 },
              )
            : defaultReminderTiming(category),
          category,
        )}
        onConfirm={(timing) => {
          if (editing) onUpdate?.(editing, timing);
          else onAdd(timing);
        }}
        onClose={() => setEditing(undefined)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  button: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});

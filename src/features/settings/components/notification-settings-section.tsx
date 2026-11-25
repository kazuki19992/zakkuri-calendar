import { Spacing, Typography } from '@/constants/theme';
import { notificationFailure } from '@/features/notifications/notification-notice-model';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { SingleSelectSheet } from '@/shared/components/single-select-sheet';
import { ReminderTimingPicker } from '@/shared/components/reminder-timing-picker';
import {
  NOTIFICATION_CATEGORIES,
  defaultReminderTiming,
  editableReminderTiming,
  timingLabel,
  type NotificationCategory,
} from '@/domain/notifications/reminder-timing';
import { SettingsDivider, SettingsGroup, SettingsRow, settingsListStyles } from './settings-list';
import type { NotificationDefaultsState } from '../hooks/use-notification-defaults';
import type { NotificationRuntime } from '@/features/notifications/notification-context';
const LABELS: Record<NotificationCategory, string> = {
  exact: 'きっちり予定',
  all_day: '終日予定',
  fuzzy_day: '日内のざっくり予定',
  fuzzy_period: '週・月のざっくり予定',
};
export function NotificationSettingsSection({
  defaults,
  runtime,
}: Readonly<{
  defaults: NotificationDefaultsState;
  runtime: NotificationRuntime;
}>) {
  const theme = useTheme(),
    [selecting, setSelecting] = useState<NotificationCategory | null>(null),
    [editing, setEditing] = useState<NotificationCategory | null>(null),
    [actionError, setActionError] = useState<string | null>(null),
    pending = useRef<NotificationCategory | null>(null);
  const actionOperation = useRef(0);
  const action = (label: string, task: () => Promise<void>, description?: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      style={styles.row}
      onPress={() => {
        const operation = ++actionOperation.current;
        setActionError(null);
        void task().catch(() => {
          if (operation === actionOperation.current)
            setActionError('端末の設定を開けませんでした。');
        });
      }}
    >
      <Text style={{ color: theme.calendarAccent }}>{label}</Text>
      {description ? <Text style={[styles.actionNote, { color: theme.textSecondary }]}>{description}</Text> : null}
    </Pressable>
  );
  const state = runtime.state;
  const failure = notificationFailure(state);
  return (
    <>
      <SettingsGroup title="新規予定の通知" footer="通知は予定ごとに変更できます。">
        {NOTIFICATION_CATEGORIES.map((key, index) => {
          const entry = defaults.entries[key];
          const disabled = entry?.status !== 'ready' || entry.isSaving;
          const timing = entry?.value ? timingLabel(entry.value) : '通知なし';
          return <View key={key}>
            {index > 0 ? <SettingsDivider /> : null}
            <SettingsRow title={LABELS[key]} value={entry?.status === 'loading' ? '読み込み中' : timing}
              accessibilityLabel={`${LABELS[key]}の通知、${timing}`} disabled={disabled}
              onPress={() => setSelecting(key)} />
            {entry?.error ? (
              <>
                <Text
                  accessibilityRole="alert"
                  style={[settingsListStyles.note, { color: theme.calendarHoliday }]}
                >
                  {entry.error}
                </Text>
                <View style={settingsListStyles.inset}>{action(`${LABELS[key]}の通知設定を再試行`, () => defaults.retry(key))}</View>
              </>
            ) : null}
          </View>;
        })}
      </SettingsGroup>
      <SettingsGroup title="端末への通知">
        <View style={styles.device}>
          <Text style={{ color: theme.text }}>
            {state.permission === 'unsupported'
              ? 'この環境では端末通知は利用できません。'
              : state.permission === 'quiet'
                ? '静かな通知が許可されています。'
                : state.permission === 'granted'
                  ? '通知は許可されています。'
                  : '通知は許可されていません。'}
          </Text>
          {state.permission !== 'unsupported' ? (
            <>
              {failure?.permission
                ? null
                : state.permission === 'undetermined'
                  ? action('通知を許可する', runtime.requestPermission)
                  : action('端末の通知設定を開く', runtime.openSettings)}
              {Platform.OS === 'android'
                ? action(
                    'アラームとリマインダーの設定',
                    runtime.openAlarmSettings,
                    '未許可や省電力設定では通知が遅れることがあります。',
                  )
                : null}
              {failure ? <>
                <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{failure.message}</Text>
                {action(failure.retryLabel, failure.permission ? runtime.requestPermission : runtime.retry)}
              </> : null}
            </>
          ) : null}
          {actionError ? (
            <Text
              accessibilityRole="alert"
              style={{ color: theme.calendarHoliday }}
            >
              {actionError}
            </Text>
          ) : null}
        </View>
      </SettingsGroup>
      <SingleSelectSheet
        visible={selecting !== null}
        title="既定の通知"
        value={
          selecting && defaults.entries[selecting]?.value ? 'custom' : 'none'
        }
        options={[
          { value: 'none', label: '通知なし' },
          { value: 'custom', label: '通知タイミングを指定' },
        ]}
        onSelect={(value) => {
          if (!selecting) return;
          if (value === 'custom') pending.current = selecting;
          else void defaults.setValue(selecting, null);
        }}
        onClose={() => {
          setSelecting(null);
          if (pending.current) {
            setEditing(pending.current);
            pending.current = null;
          }
        }}
      />
      {editing ? (
        <ReminderTimingPicker
          visible
          value={editableReminderTiming(
            defaults.entries[editing]?.value ?? defaultReminderTiming(editing),
            editing,
          )}
          fixedAnchor
          onConfirm={(value) => {
            void defaults.setValue(editing, value);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({
  device: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.twelve, gap: Spacing.twelve },
  row: { minHeight: 44, justifyContent: 'center' },
  actionNote: { fontSize: Typography.caption, marginTop: Spacing.one },
});

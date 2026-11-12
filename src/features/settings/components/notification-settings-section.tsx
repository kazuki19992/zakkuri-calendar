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
  const action = (label: string, task: () => Promise<void>) => (
    <Pressable
      accessibilityRole="button"
      style={styles.row}
      onPress={() =>
        void task().catch(() =>
          setActionError('端末の設定を開けませんでした。'),
        )
      }
    >
      <Text style={{ color: theme.calendarAccent }}>{label}</Text>
    </Pressable>
  );
  const state = runtime.state;
  return (
    <View style={[styles.section, { borderBottomColor: theme.calendarBorder }]}>
      <Text accessibilityRole="header" style={{ color: theme.textSecondary }}>
        通知
      </Text>
      {NOTIFICATION_CATEGORIES.map((key) => {
        const e = defaults.entries[key],
          disabled = e?.status !== 'ready' || e.isSaving;
        return (
          <View key={key}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${LABELS[key]}の通知、${e?.value ? timingLabel(e.value) : '通知なし'}`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => setSelecting(key)}
              style={styles.row}
            >
              <Text style={{ color: theme.text }}>{LABELS[key]}</Text>
              <Text style={{ color: theme.textSecondary, flexShrink: 1 }}>
                {e?.status === 'loading'
                  ? '読込み中'
                  : e?.value
                    ? timingLabel(e.value)
                    : '通知なし'}{' '}
                ▾
              </Text>
            </Pressable>
            {e?.error ? (
              <>
                <Text
                  accessibilityRole="alert"
                  style={{ color: theme.calendarHoliday }}
                >
                  {e.error}
                </Text>
                {action(`${LABELS[key]}の通知設定を再試行`, () =>
                  defaults.retry(key),
                )}
              </>
            ) : null}
          </View>
        );
      })}
      <Text style={{ color: theme.textSecondary }}>
        新しく作る予定に使います。保存済みの予定は変わりません。予定ごとに通知を追加・変更・削除できます。
      </Text>
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
          {state.permission === 'undetermined'
            ? action('通知を許可する', runtime.requestPermission)
            : action('端末の通知設定を開く', runtime.openSettings)}
          {Platform.OS === 'android' ? (
            <>
              <Text style={{ color: theme.textSecondary }}>
                正確な時刻での通知には「アラームとリマインダー」の許可が必要です。未許可・省電力設定では遅れる場合があります。
              </Text>
              {action(
                'アラームとリマインダーの設定',
                runtime.openAlarmSettings,
              )}
            </>
          ) : null}
          <Text style={{ color: theme.textSecondary }}>
            {state.status === 'syncing'
              ? '通知を準備しています。'
              : state.status === 'error'
                ? '一部の通知を準備できませんでした。'
                : '近い予定から通知を準備しています。'}
            {state.through
              ? ` 準備済みの最終日時: ${new Date(state.through).toLocaleString('ja-JP')}`
              : ''}
          </Text>
          <Text style={{ color: theme.textSecondary }}>
            近い60件・366日以内を予約します。アプリを開くと補充・更新します。長期間開かない場合や停止中の時差変更には追随できません。
          </Text>
          {action('通知を再予約する', runtime.retry)}
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
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingVertical: 20,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
});

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import type { RecurrenceEditScope, ScopeRequest } from '../recurrence-edit-model';

export function RecurrenceScopeDialog({ request, busy, onSelect, onCancel }: Readonly<{
  request: ScopeRequest | null;
  busy: boolean;
  onSelect(scope: RecurrenceEditScope): void;
  onCancel(): void;
}>) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [confirmationScope, setConfirmationScope] = useState<RecurrenceEditScope | null>(null);
  if (request === null) return null;
  const title = request.operation === 'delete' ? '削除する範囲' : '変更する範囲';
  const confirmationLabel = confirmationScope === 'following'
    ? 'これ以降の個別変更をリセットします'
    : '現在のシリーズ全体の個別変更をリセットします';
  return (
    <Modal transparent visible animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={() => { setConfirmationScope(null); onCancel(); }}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="範囲選択をキャンセル"
          disabled={busy} onPress={() => { setConfirmationScope(null); onCancel(); }}
          style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.dialog, {
          backgroundColor: theme.background,
          borderColor: theme.calendarBorder,
        }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {confirmationScope === null ? title : '個別変更のリセット'}
          </Text>
          {confirmationScope === null && request.needsExceptionResetConfirmation ? (
            <Text style={[styles.warning, { color: theme.textSecondary }]}>
              1件だけの予定には繰り返し設定を適用できません
            </Text>
          ) : null}
          {confirmationScope !== null ? (
            <>
              <Text style={[styles.warning, { color: theme.textSecondary }]}>{confirmationLabel}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="リセットして変更"
                accessibilityState={{ disabled: busy }} disabled={busy}
                onPress={() => { setConfirmationScope(null); onSelect(confirmationScope); }}
                style={[styles.option, { borderTopColor: theme.calendarBorder }]}>
                <Text style={{ color: theme.calendarAccent }}>リセットして変更</Text>
              </Pressable>
            </>
          ) : request.options.map((option) => (
            <Pressable key={option.scope} accessibilityRole="button"
              accessibilityLabel={option.label} accessibilityState={{ disabled: busy }}
              disabled={busy} onPress={() => request.needsExceptionResetConfirmation
                ? setConfirmationScope(option.scope)
                : onSelect(option.scope)}
              style={[styles.option, { borderTopColor: theme.calendarBorder }]}>
              <Text style={{ color: request.operation === 'delete'
                ? theme.calendarHoliday
                : theme.calendarAccent }}>{option.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="キャンセル"
            accessibilityState={{ disabled: busy }} disabled={busy}
            onPress={confirmationScope === null
              ? () => { setConfirmationScope(null); onCancel(); }
              : () => setConfirmationScope(null)}
            style={[styles.option, { borderTopColor: theme.calendarBorder }]}>
            <Text style={{ color: theme.textSecondary }}>キャンセル</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  dialog: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, maxWidth: 420, width: '100%' },
  title: { fontSize: 18, fontWeight: '600', paddingHorizontal: 18, paddingTop: 18 },
  warning: { fontSize: 13, paddingHorizontal: 18, paddingBottom: 10, paddingTop: 6 },
  option: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 52 },
});

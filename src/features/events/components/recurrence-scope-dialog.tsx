import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import type { RecurrenceEditScope, ScopeRequest } from '../recurrence-edit-model';

export function RecurrenceScopeDialog({ request, busy, onSelect, onCancel, showUnsavedWarning = true }: Readonly<{
  request: ScopeRequest | null;
  busy: boolean;
  showUnsavedWarning?: boolean;
  onSelect(scope: RecurrenceEditScope): void;
  onCancel(): void;
}>) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [confirmationScope, setConfirmationScope] = useState<RecurrenceEditScope | null>(null);
  if (request === null) return null;
  const title = request.operation === 'delete' ? '削除する範囲' : '変更する範囲';
  const preview=confirmationScope?request.relativePreviews?.[confirmationScope]:undefined;
  const resetNeeded=request.needsExceptionResetConfirmation&&confirmationScope!=='occurrence';
  const confirmText=resetNeeded?'リセットして変更':'この内容で変更';
  const confirmationLabel = confirmationScope === 'following'
    ? 'これ以降の個別変更をリセットします'
    : '現在のシリーズ全体の個別変更をリセットします';
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={() => { setConfirmationScope(null); onCancel(); }}>
      <SafeAreaView style={[styles.overlay, { backgroundColor: theme.calendarBackdrop }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="範囲選択をキャンセル"
          disabled={busy} onPress={() => { setConfirmationScope(null); onCancel(); }}
          style={StyleSheet.absoluteFill} />
        <ScrollView accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.background }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {confirmationScope === null ? title : resetNeeded?'個別変更のリセット':'変更内容の確認'}
          </Text>
          {request.operation==='delete' && showUnsavedWarning?<Text style={[styles.warning,{color:theme.textSecondary}]}>保存していないメモの変更も破棄されます。</Text>:null}
          {confirmationScope === null && request.needsExceptionResetConfirmation && !request.options.some(option=>option.scope==='occurrence') ? (
            <Text style={[styles.warning, { color: theme.textSecondary }]}>
              1件だけの予定には繰り返し設定を適用できません
            </Text>
          ) : null}
          {confirmationScope !== null ? (
            <>
              {resetNeeded?<Text style={[styles.warning, { color: theme.textSecondary }]}>{confirmationLabel}</Text>:null}
              {preview?.map((line,index)=><Text key={index} style={[styles.warning,{color:theme.text}]}>{line}</Text>)}
              <Pressable accessibilityRole="button" accessibilityLabel={confirmText}
                accessibilityState={{ disabled: busy }} disabled={busy}
                onPress={() => { setConfirmationScope(null); onSelect(confirmationScope); }}
                style={[styles.option, { borderTopColor: theme.calendarBorder }]}>
                <Text style={{ color: theme.calendarAccent }}>{confirmText}</Text>
              </Pressable>
            </>
          ) : request.options.map((option) => (
            <Pressable key={option.scope} accessibilityRole="button"
              accessibilityLabel={option.label} accessibilityState={{ disabled: busy }}
              disabled={busy} onPress={() => request.needsExceptionResetConfirmation || request.relativePreviews?.[option.scope]
                ? setConfirmationScope(option.scope)
                : onSelect(option.scope)}
              style={[styles.option, { borderTopColor: theme.calendarBorder }]}>
              <Text style={{ color: request.operation === 'delete' ? theme.danger : theme.text }}>{option.label}</Text>
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
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: { maxHeight:'85%',flexGrow:0,borderRadius: Radii.large, maxWidth: 420, width: '100%' },
  title: { fontSize: Typography.title, fontWeight: '600', paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  warning: { fontSize: Typography.caption, paddingHorizontal: Spacing.three, paddingBottom: Spacing.twelve, paddingTop: Spacing.two },
  option: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 52 },
});

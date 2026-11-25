import { Spacing, Typography } from '@/constants/theme';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ThisWeekDeadlineWeekday } from '@/domain/temporal/relative-date-resolution';
import type { TemporalDefinition } from '@/domain/temporal/temporal-definition';
import type { TemporalDefinitionPatch } from '@/domain/temporal/temporal-preferences';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { TemporalPreview } from '../components/temporal-preview';

export function TemporalFadeAdjustmentScreen({
  definition, deadlineWeekday, onSnap, onAccept, onCancel,
}: Readonly<{
  definition: TemporalDefinition;
  deadlineWeekday?: ThisWeekDeadlineWeekday;
  onSnap?(): void;
  onAccept(patch: Pick<TemporalDefinitionPatch, 'fadeInRatio' | 'fadeOutRatio'>): void;
  onCancel(): void;
}>) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [draft, setDraft] = useState(definition);
  const [dragging, setDragging] = useState(false);

  return (
    <Modal visible presentationStyle="fullScreen" allowSwipeDismissal={false} statusBarTranslucent navigationBarTranslucent
      testID="temporal-fade.modal" animationType={reduceMotion ? 'none' : 'fade'}
      // Androidのシステムバックでも調整画面を閉じず、操作ボタンに統一する。
      onRequestClose={() => {}}>
      <SafeAreaView testID="temporal-fade.screen" style={[styles.screen, { backgroundColor: theme.background }]} accessibilityViewIsModal>
        <View style={[styles.header, { borderBottomColor: theme.calendarBorder }]}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.action}>
            <Text style={[styles.actionText, { color: theme.text }]}>キャンセル</Text>
          </Pressable>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>ぼかしの調整</Text>
          <Pressable accessibilityRole="button" style={styles.action} onPress={() => onAccept({
            fadeInRatio: draft.fadeInRatio, fadeOutRatio: draft.fadeOutRatio,
          })}>
            <Text style={[styles.actionText, { color: theme.calendarAccent }]}>完了</Text>
          </Pressable>
        </View>
        <ScrollView scrollEnabled={!dragging} contentContainerStyle={styles.content}>
          <TemporalPreview definition={draft} deadlineWeekday={deadlineWeekday} large
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            onDraggingChange={setDragging} onSnap={onSnap} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.twelve, gap: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.two, flexShrink: 1 },
  actionText: { textAlign: 'center' },
  title: { fontSize: Typography.row, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.four },
});

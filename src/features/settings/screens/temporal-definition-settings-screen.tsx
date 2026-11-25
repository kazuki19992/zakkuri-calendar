import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DurationWheelPicker } from '@/shared/components/duration-wheel-picker';
import type { HolidayPreferencesState } from '../hooks/use-holiday-preferences';
import type { RelativeDateSettingsState } from '../hooks/use-relative-date-settings';
import type { useTemporalDefinitionSettings } from '../hooks/use-temporal-definition-settings';
import { TemporalRangeFields } from '../components/temporal-range-fields';
import { ThisWeekDeadlineSettings } from '../components/this-week-deadline-settings';
import { TemporalPreview } from '../components/temporal-preview';
import type { ClockField } from '../components/temporal-preview-scale';
import { formatClock, formatPercent, formatTemporalRange } from '../temporal-preferences-model';
import { TemporalFadeAdjustmentScreen } from './temporal-fade-adjustment-screen';

function EditAction({ label, onPress, disabled = false, accessibilityLabel = label, primary = false }: Readonly<{
  label: string;
  onPress(): void;
  disabled?: boolean;
  accessibilityLabel?: string;
  primary?: boolean;
}>) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, primary && styles.primary, pressed && { opacity: 0.82 }]}>
      <Text numberOfLines={2} style={[styles.actionText, {
        color: disabled ? theme.textDisabled : primary ? theme.calendarAccent : theme.text,
      }]}>{label}</Text>
    </Pressable>
  );
}

export function TemporalDefinitionSaveAction({ state }: Readonly<{
  state: ReturnType<typeof useTemporalDefinitionSettings>;
}>) {
  const theme = useTheme();
  const disabled = state.isSaving || !state.dirty || !!state.validationError;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
      style={styles.headerAction} onPress={() => { void state.prepareSave(); }}>
      <Text style={{ color: disabled ? theme.textDisabled : theme.calendarAccent }}>{state.isSaving ? '保存中…' : '保存'}</Text>
    </Pressable>
  );
}

export function TemporalDefinitionSettingsScreen({ state, onSaved, thisWeek, onSnap }: Readonly<{
  state: ReturnType<typeof useTemporalDefinitionSettings>;
  onSaved(): void;
  thisWeek?: Readonly<{ deadline: RelativeDateSettingsState; holidays: HolidayPreferencesState }>;
  onSnap?(): void;
}>) {
  const theme = useTheme();
  const [adjustingFade, setAdjustingFade] = useState(false);
  const [clockField, setClockField] = useState<ClockField | null>(null);
  if (state.status !== 'ready' || !state.draft) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: theme.background }]}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
          <Text style={{ color: theme.text }}>{state.status === 'loading' ? '読み込み中…' : state.error}</Text>
          {state.status === 'error' ? <EditAction label="再読み込み" onPress={state.reload} /> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const draft = state.draft;
  const config = draft.resolverConfig;
  const deadlineWeekday = thisWeek?.deadline.weekday;
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" testID="temporal-definition.scroll"
        contentContainerStyle={styles.content}>
        {draft.resolverConfig.kind === 'weekRemainder' && thisWeek ? <ThisWeekDeadlineSettings {...thisWeek} /> : null}
        <TemporalPreview definition={draft} deadlineWeekday={deadlineWeekday}
          onEditClock={state.isSaving ? undefined : setClockField}
          onAdjustFade={state.isSaving || state.validationError ? undefined : () => setAdjustingFade(true)} />
        {state.validationError ? (
          <Text accessibilityRole="alert" style={{ color: theme.danger }}>{state.validationError}</Text>
        ) : null}
        {draft.resolverConfig.kind !== 'weekRemainder' ? (
          <View style={styles.section}>
            <TemporalRangeFields definition={draft} onChange={state.edit} disabled={state.isSaving} />
          </View>
        ) : null}
        {state.error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{state.error}</Text> : null}
      </ScrollView>

      <View testID="temporal-definition.actions" style={[styles.actions, { borderTopColor: theme.calendarBorder }]}>
        <EditAction label="初期値に戻す" onPress={state.restore} disabled={state.isSaving} />
      </View>

      {adjustingFade ? (
        <TemporalFadeAdjustmentScreen definition={draft} deadlineWeekday={deadlineWeekday} onSnap={onSnap}
          onCancel={() => setAdjustingFade(false)} onAccept={(patch) => {
            if (patch.fadeInRatio !== draft.fadeInRatio || patch.fadeOutRatio !== draft.fadeOutRatio) state.edit(patch);
            setAdjustingFade(false);
          }} />
      ) : null}
      {config.kind === 'timeOfDay' ? (
        <DurationWheelPicker visible={clockField !== null}
          title={clockField === 'startMinute' ? '開始時刻' : '終了時刻'}
          initialMinutes={clockField === 'startMinute' ? config.startMinute : config.endMinute % 1440}
          maxHours={23} minuteStep={15} hourUnit="時" formatValue={formatClock}
          onClose={() => setClockField(null)} onConfirm={(minute) => {
            if (!clockField) return;
            const nextMinute = clockField === 'startMinute' ? minute : minute + Math.floor(config.endMinute / 1440) * 1440;
            if (nextMinute !== config[clockField]) state.edit({ resolverConfig: { ...config, [clockField]: nextMinute } });
          }} />
      ) : null}

      <Modal visible={state.preview !== null} transparent statusBarTranslucent navigationBarTranslucent
        animationType="none" onRequestClose={state.cancelPreview}>
        <SafeAreaView testID="temporal-definition.confirmation" style={[styles.backdrop, { backgroundColor: theme.calendarBackdrop }]}>
          <ScrollView style={[styles.dialog, { backgroundColor: theme.background }]}
            contentContainerStyle={styles.dialogContent} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>変更内容の確認</Text>
            {state.preview ? <>
              <Text style={{ color: theme.text }}>
                {draft.label}　{formatTemporalRange(state.preview.definition)} → {formatTemporalRange(state.preview.next)}
              </Text>
              <Text style={{ color: theme.text }}>
                開始のぼかし　{formatPercent(state.preview.definition.fadeInRatio)} → {formatPercent(state.preview.next.fadeInRatio)}
                {'\n'}終了のぼかし　{formatPercent(state.preview.definition.fadeOutRatio)} → {formatPercent(state.preview.next.fadeOutRatio)}
              </Text>
              <Text style={{ color: theme.text }}>
                既存の予定{state.preview.count}件に反映します。繰り返しはシリーズごとに1件です。範囲の変更で、今後の通知時刻が変わる場合があります。
              </Text>
            </> : null}
            <View style={styles.dialogActions}>
              <EditAction label="キャンセル" onPress={state.cancelPreview} disabled={state.isSaving} />
              <EditAction label="保存する" primary disabled={state.isSaving}
                onPress={() => { void state.confirmSave().then((ok) => { if (ok) onSaved(); }); }} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 680, padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.three },
  section: { gap: Spacing.twelve, paddingTop: Spacing.twelve },
  heading: { fontSize: Typography.row, fontWeight: '600' },
  headerAction: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: Spacing.twelve,
    paddingVertical: Spacing.two, alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  primary: { flex: 1 },
  actionText: { fontSize: Typography.row, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.twelve, padding: Spacing.twelve, borderTopWidth: StyleSheet.hairlineWidth },
  backdrop: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  dialog: { maxHeight: '85%', flexGrow: 0, borderRadius: Radii.large },
  dialogContent: { padding: Spacing.three, gap: Spacing.twelve },
  dialogActions: { flexDirection: 'row', gap: Spacing.twelve },
});

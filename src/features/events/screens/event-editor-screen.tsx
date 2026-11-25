import { Spacing, Typography } from '@/constants/theme';
import { getEventColor } from '@/constants/event-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {useInlineNoteEditor} from '../hooks/use-inline-note-editor';
import {InlineFormattedNoteEditor} from '../components/formatted-note-editor/inline-formatted-note-editor';
import { ExactDurationTypeField } from '../components/exact-duration-type-field';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { DeleteEventButton } from '../components/delete-event-button';
import { EventColorPicker } from '../components/event-color-picker';
import { EventDateTimeFields } from '../components/event-date-time-fields';
import { EventEditorHeader } from '../components/event-editor-header';
import { EventEditorTabContent } from '../components/event-editor-tab-content';
import { EventEditorTabs } from '../components/event-editor-tabs';
import { EventMetadataFields } from '../components/event-metadata-fields';
import { EventReminderEditor } from '../components/event-reminder-editor';
import { RecurrenceEditor } from '../components/recurrence-editor';
import { RecurrenceScopeDialog } from '../components/recurrence-scope-dialog';
import { TemporalDefinitionPicker } from '../components/temporal-definition-picker';
import type { EventEditorState } from '../hooks/use-event-editor';
import type { RecurrenceEditScope } from '../recurrence-edit-model';

/**
 * 保存・削除の操作抑止と各項目の局所エラーを表示し、無関係なdraft入力は保持する。
 * メモと繰り返し範囲の確定はhookへ渡し、画面から直接永続化しない。
 */
export function EventEditorScreen({ state, onSave, onDelete, onSelectScope, onCancel }: Readonly<{
  state: EventEditorState;
  onSave(): void;
  onDelete(): void;
  onSelectScope?(scope: RecurrenceEditScope): void;
  onCancel(): void;
}>) {
  const theme = useTheme();
  const busy = state.isBusy;
  const showFuzzyFields = state.editorTab === 'fuzzy' && !state.isAllDay;
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const previewColor = state.colorId === null ? theme.calendarEvent : getEventColor(state.colorId, scheme);
  const note=useInlineNoteEditor(state.noteSession,busy||state.scopeRequest!==null);
  const {bindRoot,bindScroll,onRootLayout,onScroll,endEditing,keyboardInset}=note;
  const section = (title: string, child: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {child}
    </View>
  );
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <View ref={bindRoot} collapsable={false} onLayout={onRootLayout} style={[styles.screen, { paddingBottom: keyboardInset }]}>
        <EventEditorHeader mode={state.mode} busy={busy} ready={state.status === 'ready' && state.title.trim().length > 0 && !state.isSaveDisabled} onCancel={onCancel} onSave={onSave} />
        {state.status === 'loading' ? <View style={styles.center}><ActivityIndicator /></View> : null}
        {state.status === 'error' ? <View style={styles.center}>
          <Text style={{ color: theme.text }}>予定を読み込めませんでした</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="再試行" onPress={state.retry} style={styles.retry}><Text style={{ color: theme.calendarAccent }}>再試行</Text></Pressable>
        </View> : null}
        {state.status === 'ready' ? <ScrollView ref={bindScroll} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={styles.form} keyboardShouldPersistTaps="always">
          <View onTouchStart={endEditing}>
            <TextInput autoFocus={state.mode === 'create'} accessibilityLabel="タイトル" placeholder="タイトルを追加" placeholderTextColor={theme.textSecondary} value={state.title} onFocus={endEditing} onChangeText={state.setTitle} editable={!busy} style={[styles.titleInput, { color: theme.text, borderBottomColor: theme.calendarBorder }]} />
            {state.titleError ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{state.titleError}</Text> : null}
            <EventEditorTabs value={state.editorTab} disabled={busy} onChange={(tab) => { Keyboard.dismiss(); state.setEditorTab(tab); }} />
          </View>
          <EventEditorTabContent tab={state.editorTab}>
            <View onTouchStart={endEditing} style={styles.editorFields}>
              {section('日時', <>
                <EventDateTimeFields durationControl={<ExactDurationTypeField value={state.exactDurationType} status={state.exactDurationStatus} disabled={busy} onChange={state.setExactDurationType} onRetry={state.retryExactDuration} />} showEnd={state.exactDurationType === 'fixed'} timeInputDisabled={state.exactDurationStatus !== 'ready'} editorTab={state.editorTab} isAllDay={state.isAllDay} isDateEditable={state.isDateEditable} startDate={state.startDate} startTime={state.startTime} endDate={state.endDate} endTime={state.endTime} disabled={busy} onAllDayChange={state.setAllDay} onStartDateChange={state.setStartDate} onStartTimeChange={state.setStartTime} onEndDateChange={state.setEndDate} onEndTimeChange={state.setEndTime} />
                {showFuzzyFields ? (
                  <TemporalDefinitionPicker definitions={state.definitions} selectedId={state.selectedDefinitionId}
                    relativeRange={state.relativeDateRange} previewColor={previewColor}
                    disabled={busy} onSelect={state.selectDefinition} />
                ) : null}
                {showFuzzyFields && state.relativeDatePreview ? <Text style={{ color: theme.text }}>{state.relativeDatePreview}</Text> : null}
                {showFuzzyFields && !state.isDateEditable ? <Text style={{ color: theme.textSecondary }}>相対日付では基準日から期間を決めます</Text> : null}
                {state.dateError ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{state.dateError}</Text> : null}
                {state.endTimeError ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{state.endTimeError}</Text> : null}
              </>)}
            </View>
            {section('メモ', <InlineFormattedNoteEditor model={note} linkError={state.noteLinkError}
              onOpenLink={(url) => { void state.openNoteLink(url); }} />)}
            <View onTouchStart={endEditing}>
              {section('繰り返し', <>
                <RecurrenceEditor relativeFrequency={state.relativeRecurrence?.frequency} relativeInitialDate={state.relativeRecurrence?.periodAnchorDate} draft={state.recurrenceDraft} disabled={busy || !state.isRecurrenceEditable} error={state.recurrenceError} onPresetChange={state.setRecurrencePreset} onFrequencyChange={state.setRecurrenceFrequency} onIntervalChange={state.setRecurrenceIntervalText} onWeekdayToggle={state.toggleRecurrenceWeekday} onEndTypeChange={state.setRecurrenceEndType} onUntilDateChange={state.setRecurrenceUntilDate} onCountChange={state.setRecurrenceCountText} />
                {state.occurrenceRecurrenceNotice?<Text style={{color:theme.textSecondary}}>{state.occurrenceRecurrenceNotice}</Text>:null}
                {state.relativeRecurrence?<>
                  <Text style={{color:theme.text}}>{state.relativeRecurrence.label}</Text>
                  {state.relativeRecurrence.notice?<Text style={{color:theme.textSecondary}}>{state.relativeRecurrence.notice}</Text>:null}
                  {state.relativeRecurrence.policyDescription?<><Text style={{color:theme.textSecondary}}>{state.relativeRecurrence.policyDescription}</Text><Pressable accessibilityRole="button" disabled={busy} accessibilityState={{disabled:busy}} onPress={()=>{void state.relativeRecurrence?.updatePolicy?.();}} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:theme.calendarAccent}}>締切条件を現在の設定に更新</Text></Pressable></>:null}
                  {state.relativeRecurrence.preview.map((label,index)=><Text key={index} style={{color:theme.textSecondary}}>{index===0?'初回':`次の${index}回目`}: {label}</Text>)}
                </>:null}
                {!state.isRecurrenceEditable ? <Text style={{ color: theme.textSecondary }}>複数日のざっくり予定では現在利用できません</Text> : null}
              </>)}
              {section('色', <EventColorPicker value={state.colorId}
                disabled={busy} onChange={state.setColorId} />)}
              {section('場所', <EventMetadataFields location={state.location} disabled={busy}
                onLocationChange={state.setLocation} />)}
              {section('通知', <EventReminderEditor reminders={state.reminders} disabled={busy} error={state.reminderError} onAdd={state.addReminder} onRemove={state.removeReminder} onMove={state.moveReminder} onUpdate={state.updateReminder} category={state.reminderCategory} allowEnd={state.allowReminderEnd} defaultStatus={state.notificationDefaultStatus} onRetry={state.retryNotificationDefaults} onReset={state.resetReminderDefaults} />)}
              {state.mode === 'edit' && !note.focused && keyboardInset === 0 ? <DeleteEventButton title={state.title} disabled={busy}
                isRecurring={state.recurrenceDraft.preset !== 'none'}
                usesScopeSelection={state.usesRecurrenceScope} onDelete={onDelete} /> : null}
            </View>
            {state.saveError ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{state.saveError}</Text> : null}
          </EventEditorTabContent>
        </ScrollView> : null}
      </View>
      <RecurrenceScopeDialog request={state.scopeRequest} busy={busy}
        onSelect={(scope) => onSelectScope?.(scope)} onCancel={state.cancelScope} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  retry: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 80 },
  form: { paddingHorizontal: Spacing.three, paddingTop: Spacing.twelve, paddingBottom: Spacing.six },
  titleInput: { borderBottomWidth: StyleSheet.hairlineWidth, fontSize: Typography.title, minHeight: 56, paddingHorizontal: 0 },
  section: { gap: Spacing.twelve, paddingBottom: Spacing.three, paddingTop: Spacing.three },
  sectionTitle: { fontSize: Typography.body, fontWeight: '600' },
  editorFields: { marginTop: Spacing.three },
});

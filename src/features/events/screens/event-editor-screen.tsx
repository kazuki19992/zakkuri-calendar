import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { DeleteEventButton } from '../components/delete-event-button';
import { EventColorPicker } from '../components/event-color-picker';
import { EventDateTimeFields } from '../components/event-date-time-fields';
import { EventEditorHeader } from '../components/event-editor-header';
import { EventEditorTabContent } from '../components/event-editor-tab-content';
import { EventEditorTabs } from '../components/event-editor-tabs';
import { EventMetadataFields, EventNoteField } from '../components/event-metadata-fields';
import { FormattedNoteEditorModal } from '../components/formatted-note-editor/formatted-note-editor-modal';
import { EventReminderEditor } from '../components/event-reminder-editor';
import { RecurrenceEditor } from '../components/recurrence-editor';
import { RecurrenceScopeDialog } from '../components/recurrence-scope-dialog';
import { TemporalDefinitionPicker } from '../components/temporal-definition-picker';
import type { EventEditorState } from '../hooks/use-event-editor';
import type { RecurrenceEditScope } from '../recurrence-edit-model';

export function EventEditorScreen({ state, onSave, onDelete, onSelectScope, onCancel }: Readonly<{
  state: EventEditorState;
  onSave(): void;
  onDelete(): void;
  onSelectScope?(scope: RecurrenceEditScope): void;
  onCancel(): void;
}>) {
  const theme = useTheme();
  const busy = state.isSaving || state.isDeleting;
  const section = (title: string, child: React.ReactNode) => (
    <View style={[styles.section, { borderBottomColor: theme.calendarBorder }]}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      {child}
    </View>
  );
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <EventEditorHeader mode={state.mode} busy={busy} ready={state.status === 'ready'} onCancel={onCancel} onSave={onSave} />
        {state.status === 'loading' ? <View style={styles.center}><ActivityIndicator /></View> : null}
        {state.status === 'error' ? <View style={styles.center}>
          <Text style={{ color: theme.text }}>予定を読み込めませんでした</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="再試行" onPress={state.retry} style={styles.retry}><Text style={{ color: theme.calendarAccent }}>再試行</Text></Pressable>
        </View> : null}
        {state.status === 'ready' ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <TextInput accessibilityLabel="タイトル" placeholder="タイトルを追加" placeholderTextColor={theme.textSecondary} value={state.title} onChangeText={state.setTitle} editable={!busy} style={[styles.titleInput, { color: theme.text, borderBottomColor: theme.calendarBorder }]} />
          {state.titleError ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{state.titleError}</Text> : null}
          <EventEditorTabs value={state.editorTab} disabled={busy} onChange={state.setEditorTab} />
          <EventEditorTabContent tab={state.editorTab}>
          {section('日時', <>
            <EventDateTimeFields editorTab={state.editorTab} isAllDay={state.isAllDay} isDateEditable={state.isDateEditable} startDate={state.startDate} startTime={state.startTime} endDate={state.endDate} endTime={state.endTime} disabled={busy} onAllDayChange={state.setAllDay} onStartDateChange={state.setStartDate} onStartTimeChange={state.setStartTime} onEndDateChange={state.setEndDate} onEndTimeChange={state.setEndTime} />
            {state.editorTab === 'fuzzy' ? <TemporalDefinitionPicker definitions={state.definitions} selectedId={state.selectedDefinitionId} disabled={busy} onSelect={state.selectDefinition} /> : null}
            {state.relativeDatePreview ? <Text style={{ color: theme.text }}>{state.relativeDatePreview}</Text> : null}
            {!state.isDateEditable ? <Text style={{ color: theme.textSecondary }}>相対日付では基準日から期間を決めます</Text> : null}
            {state.dateError ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{state.dateError}</Text> : null}
            {state.endTimeError ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{state.endTimeError}</Text> : null}
          </>)}
          {section('繰り返し', <>
            <RecurrenceEditor draft={state.recurrenceDraft} disabled={busy || !state.isRecurrenceEditable} error={state.recurrenceError} onPresetChange={state.setRecurrencePreset} onFrequencyChange={state.setRecurrenceFrequency} onIntervalChange={state.setRecurrenceIntervalText} onWeekdayToggle={state.toggleRecurrenceWeekday} onEndTypeChange={state.setRecurrenceEndType} onUntilDateChange={state.setRecurrenceUntilDate} onCountChange={state.setRecurrenceCountText} />
            {!state.isRecurrenceEditable ? <Text style={{ color: theme.textSecondary }}>複数日のざっくり予定では現在利用できません</Text> : null}
          </>)}
          {section('カレンダーと色', <View style={styles.group}>
            <View style={styles.readonlyRow}><Text style={{ color: theme.textSecondary }}>カレンダー</Text><Text style={{ color: theme.text }}>{state.calendarName}</Text></View>
            <EventColorPicker calendarColorId={state.calendarColorId} value={state.colorId} disabled={busy} onChange={state.setColorId} />
          </View>)}
          {section('場所', <EventMetadataFields location={state.location} disabled={busy}
            onLocationChange={state.setLocation} />)}
          {section('通知', <EventReminderEditor reminders={state.reminders} disabled={busy} error={state.reminderError} onAdd={state.addReminder} onRemove={state.removeReminder} onMove={state.moveReminder} />)}
          {section('メモ', <EventNoteField summary={state.noteSummary} disabled={busy}
            error={state.noteLinkError} onPress={state.openNoteEditor} />)}
          {state.saveError ? <Text accessibilityRole="alert" style={{ color: theme.calendarHoliday }}>{state.saveError}</Text> : null}
          {state.mode === 'edit' ? <DeleteEventButton title={state.title} disabled={busy}
            isRecurring={state.recurrenceDraft.preset !== 'none'}
            usesScopeSelection={state.usesRecurrenceScope} onDelete={onDelete} /> : null}
          </EventEditorTabContent>
        </ScrollView> : null}
      </KeyboardAvoidingView>
      <RecurrenceScopeDialog request={state.scopeRequest} busy={busy}
        onSelect={(scope) => onSelectScope?.(scope)} onCancel={state.cancelScope} />
      <FormattedNoteEditorModal visible={state.isNoteEditorOpen}
        initialDocument={state.noteDocument} disabled={busy} linkError={state.noteLinkError}
        onCancel={state.cancelNoteEditor} onComplete={state.completeNoteEditor}
        onOpenLink={(url) => { void state.openNoteLink(url); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  retry: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 80 },
  form: { padding: 16, paddingBottom: 48 },
  titleInput: { borderBottomWidth: StyleSheet.hairlineWidth, fontSize: 22, minHeight: 56, paddingHorizontal: 0 },
  section: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 10, paddingBottom: 18, paddingTop: 18 },
  sectionTitle: { fontSize: 13 },
  group: { gap: 12 },
  readonlyRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 },
});

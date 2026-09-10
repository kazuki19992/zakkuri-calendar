import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { DeleteEventButton } from '../components/delete-event-button';
import { EventDateTimeFields } from '../components/event-date-time-fields';
import { EventTypePicker } from '../components/event-type-picker';
import { TemporalDefinitionPicker } from '../components/temporal-definition-picker';
import type { EventEditorState } from '../hooks/use-event-editor';

export function EventEditorScreen({ state, onSave, onDelete, onCancel }: Readonly<{ state: EventEditorState; onSave(): void; onDelete(): void; onCancel(): void }>) {
  const theme = useTheme(); const busy = state.isSaving || state.isDeleting;
  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
    <View style={[styles.header, { borderBottomColor: theme.calendarBorder }]}><Pressable accessibilityRole="button" accessibilityLabel="キャンセル" disabled={busy} onPress={onCancel} style={styles.headerButton}><Text style={{ color: theme.calendarAccent }}>キャンセル</Text></Pressable><Text style={[styles.title, { color: theme.text }]}>{state.mode === 'edit' ? '予定を編集' : '予定を追加'}</Text><Pressable accessibilityRole="button" accessibilityLabel="保存" disabled={busy || state.status !== 'ready'} onPress={onSave} style={styles.headerButton}><Text style={{ color: theme.calendarAccent }}>{busy ? '保存中' : '保存'}</Text></Pressable></View>
    {state.status === 'loading' ? <View style={styles.center}><ActivityIndicator /></View> : state.status === 'error' ? <View style={styles.center}><Text style={{ color: theme.text }}>予定を読み込めませんでした</Text><Pressable accessibilityRole="button" accessibilityLabel="再試行" onPress={state.retry} style={styles.headerButton}><Text style={{ color: theme.calendarAccent }}>再試行</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: theme.text }]}>タイトル</Text><TextInput accessibilityLabel="タイトル" value={state.title} onChangeText={state.setTitle} editable={!busy} style={[styles.input, { color: theme.text, borderColor: theme.calendarBorder }]} />
      {state.titleError ? <Text style={{ color: theme.calendarHoliday }}>{state.titleError}</Text> : null}
      <Text style={[styles.label, { color: theme.text }]}>種類</Text><EventTypePicker value={state.temporalType} disabled={busy} onChange={state.setTemporalType} />
      <EventDateTimeFields date={state.anchorDate} startTime={state.startTime} endTime={state.endTime} disabled={busy} showTimes={state.temporalType === 'exact'} onDateChange={state.setAnchorDate} onStartTimeChange={state.setStartTime} onEndTimeChange={state.setEndTime} />
      {state.temporalType === 'fuzzy' ? <TemporalDefinitionPicker definitions={state.definitions} selectedId={state.selectedDefinitionId} disabled={busy} onSelect={state.selectDefinition} /> : null}
      {state.endTimeError ? <Text style={{ color: theme.calendarHoliday }}>{state.endTimeError}</Text> : null}{state.saveError ? <Text style={{ color: theme.calendarHoliday }}>{state.saveError}</Text> : null}
      {state.mode === 'edit' ? <DeleteEventButton title={state.title} disabled={busy} onDelete={onDelete} /> : null}
    </ScrollView>}
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 }, headerButton: { justifyContent: 'center', minHeight: 44, minWidth: 80 }, title: { fontSize: 17, fontWeight: '700' }, center: { alignItems: 'center', flex: 1, justifyContent: 'center' }, form: { gap: 8, padding: 16, paddingBottom: 48 }, label: { fontSize: 15, fontWeight: '700', marginTop: 12 }, input: { borderRadius: 8, borderWidth: 1, fontSize: 17, minHeight: 48, paddingHorizontal: 12 } });

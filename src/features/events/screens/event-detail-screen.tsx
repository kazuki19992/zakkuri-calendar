import { Spacing, Typography } from '@/constants/theme';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { DeleteEventButton } from '../components/delete-event-button';
import type { EventDetailState } from '../hooks/use-event-details';

export function EventDetailScreen({ state, deleting, canDelete, usesScopeSelection, deleteError, onClose, onEdit, onDelete }: Readonly<{
  state: EventDetailState;
  deleting: boolean;
  canDelete: boolean;
  usesScopeSelection: boolean;
  deleteError: string | null;
  onClose(): void;
  onEdit(): void;
  onDelete(): void;
}>) {
  const theme = useTheme();
  const ready = state.status === 'ready';
  const text = { color: theme.text };
  const secondary = { color: theme.textSecondary };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.calendarBorder }]}>
        <Pressable accessibilityRole="button" disabled={deleting} onPress={onClose} style={styles.headerAction}>
          <Text style={text}>閉じる</Text>
        </Pressable>
        <Text style={[styles.heading, text]}>予定</Text>
        <Pressable accessibilityRole="button" disabled={!ready || deleting} onPress={onEdit} style={styles.headerAction}>
          <Text style={{ color: ready && !deleting ? theme.calendarAccent : theme.textDisabled }}>編集</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {state.status === 'loading' ? (
          <ActivityIndicator accessibilityLabel="予定を読み込み中" />
        ) : state.status === 'ready' ? (
          <>
            <Text selectable accessibilityRole="header" style={[styles.title, text]}>{state.details.title}</Text>
            <Text selectable style={[styles.body, text]}>{state.details.timeLabel}</Text>
            {state.details.recurring ? <Text style={secondary}>繰り返し</Text> : null}
            {state.details.location ? <View style={styles.section}>
              <Text accessibilityRole="header" style={secondary}>場所</Text>
              <Text selectable style={[styles.body, text]}>{state.details.location}</Text>
            </View> : null}
            {state.details.reminders.length > 0 ? <View style={styles.section}>
              <Text accessibilityRole="header" style={secondary}>通知</Text>
              {state.details.reminders.map(({ id, dateTime, condition }) => (
                <View key={id} style={styles.reminder}>
                  {dateTime ? <Text selectable style={[styles.body, text]}>{dateTime}</Text> : null}
                  <Text style={dateTime ? secondary : text}>{condition}</Text>
                </View>
              ))}
            </View> : null}
            {state.details.note ? <View style={styles.section}>
              <Text accessibilityRole="header" style={secondary}>メモ</Text>
              <Text selectable style={[styles.body, text]}>{state.details.note}</Text>
            </View> : null}
          </>
        ) : (
          <>
            <Text accessibilityRole="alert" style={[styles.body, text]}>
              {state.status === 'missing' ? '予定が見つかりません' : '予定を読み込めませんでした'}
            </Text>
            {state.status === 'error' ? <Pressable accessibilityRole="button" onPress={state.retry}
              style={styles.retry}><Text style={{ color: theme.calendarAccent }}>再読み込み</Text></Pressable> : null}
          </>
        )}
      </ScrollView>
      {state.status === 'ready' ? (
        <View style={[styles.footer, { borderTopColor: theme.calendarBorder }]}>
          {deleteError ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{deleteError}</Text> : null}
          <DeleteEventButton title={state.details.title} isRecurring={state.details.recurring}
            disabled={!canDelete || deleting} usesScopeSelection={usesScopeSelection} showUnsavedWarning={false}
            onDelete={onDelete} atFooter />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
  headerAction: { alignItems: 'center', justifyContent: 'center', minHeight: 52, minWidth: 56 },
  heading: { fontSize: Typography.row, fontWeight: '600' },
  content: { padding: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.twelve },
  title: { fontSize: Typography.display, fontWeight: '700' },
  body: { fontSize: Typography.row, lineHeight: 23 },
  section: { paddingTop: Spacing.three, gap: Spacing.one },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingTop: Spacing.one },
  reminder: { gap: Spacing.half },
  retry: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});

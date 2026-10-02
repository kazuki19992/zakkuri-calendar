import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  normalizeEventNoteDocument,
  parseEventNoteDocument,
  type EventNoteDocumentV1,
} from '@/domain/calendar/event-note';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { FormattedNoteEditor } from './formatted-note-editor';
import type {
  EditorSelectionState,
  FormattedNoteEditorDOMRef,
} from './formatted-note-editor.dom';
import { FormattedNoteToolbar } from './formatted-note-toolbar';

const EMPTY_SELECTION: EditorSelectionState = {
  bold: false,
  italic: false,
  bulletList: false,
  orderedList: false,
  taskList: false,
  linkUrl: null,
  dirty: false,
};

type Props = Readonly<{
  visible: boolean;
  initialDocument: EventNoteDocumentV1 | null;
  disabled: boolean;
  linkError: string | null;
  onCancel(): void;
  onComplete(document: EventNoteDocumentV1 | null): void;
  onOpenLink(url: string): void;
}>;

export function FormattedNoteEditorModal({
  visible,
  ...props
}: Props) {
  if (!visible) return null;
  return <FormattedNoteEditorModalContent {...props} />;
}

function FormattedNoteEditorModalContent({
  initialDocument,
  disabled,
  linkError,
  onCancel,
  onComplete,
  onOpenLink,
}: Omit<Props, 'visible'>) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const editorRef = useRef<FormattedNoteEditorDOMRef>(null);
  const completionRef = useRef(false);
  const dirtyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<EditorSelectionState>(EMPTY_SELECTION);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [completing, setCompleting] = useState(false);

  const handleCancel = useCallback(() => {
    if (disabled || completing) return;
    if (!dirtyRef.current) {
      onCancel();
      return;
    }
    Alert.alert('メモの変更を破棄しますか？', 'メモエディタでの変更は予定へ反映されません。', [
      { text: '編集を続ける', style: 'cancel' },
      { text: '破棄', style: 'destructive', onPress: onCancel },
    ]);
  }, [completing, disabled, onCancel]);

  const requestComplete = useCallback(() => {
    if (!ready || disabled || completionRef.current) return;
    completionRef.current = true;
    setCompleting(true);
    setError(null);
    editorRef.current?.requestComplete();
  }, [disabled, ready]);

  const receiveComplete = useCallback(async (value: EventNoteDocumentV1): Promise<void> => {
    const parsed = parseEventNoteDocument(value);
    if (!parsed.ok) {
      completionRef.current = false;
      setCompleting(false);
      setError('メモを更新できませんでした。もう一度お試しください。');
      return;
    }
    completionRef.current = false;
    setCompleting(false);
    onComplete(normalizeEventNoteDocument(parsed.value));
  }, [onComplete]);

  const receiveConversionFailure = useCallback(async (): Promise<void> => {
    completionRef.current = false;
    setCompleting(false);
    setError('メモを更新できませんでした。もう一度お試しください。');
  }, []);

  const receiveFailure = useCallback(async (): Promise<void> => {
    completionRef.current = false;
    setReady(false);
    setCompleting(false);
    setError('メモエディタを読み込めませんでした。');
  }, []);

  const retry = useCallback(() => {
    if (ready) {
      requestComplete();
      return;
    }
    setError(null);
    setRevision((value) => value + 1);
  }, [ready, requestComplete]);

  const busy = disabled || completing;
  return (
    <Modal visible presentationStyle="fullScreen" animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={handleCancel}>
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.screen}>
          <View style={[styles.header, { borderBottomColor: theme.calendarBorder }]}>
          <View style={styles.side}>
            <Pressable accessibilityRole="button" accessibilityLabel="キャンセル"
              accessibilityState={{ disabled: busy }} disabled={busy} onPress={handleCancel}
              style={styles.action}>
              <Text style={{ color: theme.calendarAccent }}>キャンセル</Text>
            </Pressable>
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>メモ</Text>
          <View style={styles.side}>
            <Pressable accessibilityRole="button" accessibilityLabel="完了"
              accessibilityState={{ disabled: busy || !ready }} disabled={busy || !ready}
              onPress={requestComplete} style={[styles.action, styles.rightAction]}>
              <Text style={{ color: theme.calendarAccent }}>{completing ? '更新中' : '完了'}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.body}>
          <FormattedNoteEditor key={revision} editorRef={editorRef}
            initialDocument={initialDocument}
            theme={{
              background: theme.background,
              text: theme.text,
              textSecondary: theme.textSecondary,
              accent: theme.calendarAccent,
            }}
            onReady={async () => { setReady(true); setError(null); }}
            onStateChange={async (state) => { dirtyRef.current = state.dirty; setSelection(state); }}
            onComplete={receiveComplete}
            onConversionFailure={receiveConversionFailure}
            onFailure={receiveFailure} />
          {!ready && error === null ? (
            <View style={styles.feedback}>
              <ActivityIndicator accessibilityLabel="メモエディタを読み込み中" />
            </View>
          ) : null}
          {error !== null ? (
            <View style={[styles.feedback, { backgroundColor: theme.background }]}>
              <Text style={[styles.error, { color: theme.calendarHoliday }]}>{error}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="再試行" onPress={retry}
                style={styles.retry}>
                <Text style={{ color: theme.calendarAccent }}>再試行</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        {linkError === null ? null : (
          <Text accessibilityRole="alert" style={[styles.linkError, {
            backgroundColor: theme.background,
            color: theme.calendarHoliday,
          }]}>{linkError}</Text>
        )}
        <FormattedNoteToolbar disabled={busy || !ready} state={selection}
          onToggleBold={() => editorRef.current?.toggleBold()}
          onToggleItalic={() => editorRef.current?.toggleItalic()}
          onToggleBulletList={() => editorRef.current?.toggleBulletList()}
          onToggleOrderedList={() => editorRef.current?.toggleOrderedList()}
          onToggleTaskList={() => editorRef.current?.toggleTaskList()}
          onOpenLink={onOpenLink} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 52, paddingHorizontal: 8 },
  side: { flex: 1 },
  action: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 4 },
  rightAction: { alignItems: 'flex-end' },
  title: { flex: 1.4, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  body: { flex: 1 },
  feedback: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, padding: 24, position: 'absolute', right: 0, top: 0 },
  error: { fontSize: 14, textAlign: 'center' },
  retry: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 88 },
  linkError: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 8, textAlign: 'center' },
});

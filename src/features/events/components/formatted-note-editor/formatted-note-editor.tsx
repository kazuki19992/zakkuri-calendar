import { useState, type RefObject } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import type { EventNoteDocumentV1 } from '@/domain/calendar/event-note';
import { createDOMNavigationPolicy } from './dom-navigation-policy';
import FormattedNoteEditorDOM, {
  type EditorSelectionState,
  type EditorTheme,
  type FormattedNoteEditorDOMRef,
} from './formatted-note-editor.dom';

type Props = Readonly<{
  editorRef: RefObject<FormattedNoteEditorDOMRef | null>;
  initialDocument: EventNoteDocumentV1 | null;
  theme: EditorTheme;
  onReady(): Promise<void>;
  onStateChange(state: EditorSelectionState): Promise<void>;
  onComplete(document: EventNoteDocumentV1 | null): Promise<void>;
  onFailure(): Promise<void>;
}>;

export function FormattedNoteEditor({
  editorRef,
  initialDocument,
  theme,
  onReady,
  onStateChange,
  onComplete,
  onFailure,
}: Props) {
  const [navigationPolicy] = useState(() =>
    createDOMNavigationPolicy(Platform.OS !== 'android'));
  return (
    <View style={styles.editor}>
      {/* Expo DOM Componentsのimperative APIへrefを渡すため、render時のref受け渡しが必要。 */}
      <FormattedNoteEditorDOM ref={editorRef} initialDocument={initialDocument}
        theme={theme} onReady={onReady} onStateChange={onStateChange}
        onComplete={onComplete} onFailure={onFailure}
        dom={{
          containerStyle: styles.editor,
          scrollEnabled: true,
          useExpoDOMWebView: false,
          unstable_useExpoModulesBridge: false,
          onLoadStart: (event: { nativeEvent: { url: string } }) => {
            navigationPolicy.seedDocumentUrl(event.nativeEvent.url);
          },
          onShouldStartLoadWithRequest: navigationPolicy.shouldStart,
        }} />
    </View>
  );
}

const styles = StyleSheet.create({ editor: { flex: 1 } });
